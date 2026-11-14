// The full answer pipeline. Normally 2 AI calls; 0 when cached; a 3rd only to repair a failed check.
import { validateQuestion, cleanHistory } from './validate.js';
import { makeKey, getCached, setCached } from './cache.js';
import { extractFacts } from './extract.js';
import { classifyRegion, resolvePolicies } from './resolver.js';
import { buildDateFacts } from './dates.js';
import { retrieve, citeLabel } from './retrieve.js';
import { embedQuery } from './embeddings.js';
import { callLLM, isRateLimit } from './llm.js';
import { SYSTEM_PROMPT, buildPrompt } from './prompt.js';
import { verifyAnswer, dropUnverifiedSentences } from './verify.js';
import { runCalculation, fillPlaceholders } from './calc.js';
import { detectLanguage, chooseLanguage, normalizeDigits, NOT_COVERED_TEXT, TEXT_LABELS } from './lang.js';
import { translateResult } from './translate.js';

// Groq free tier: gpt-oss-120b allows 8,000 tokens per minute, counting the prompt PLUS max_tokens.
// About 40 items (~3,000 tokens) + system prompt (~800) + 3,000 for the reply stays under it.
const MAX_ITEMS = 40;
const ANSWER_MAX_TOKENS = 3000;

export const NOT_COVERED = NOT_COVERED_TEXT.en;

const FALLBACK_TEXT = {
  en: { busy: 'Our assistant is very busy right now.', failed: 'Our assistant could not answer right now.', rules: 'Here are the policy rules most related to your question:' },
  ur: { busy: 'ہمارا اسسٹنٹ اس وقت بہت مصروف ہے۔', failed: 'ہمارا اسسٹنٹ اس وقت جواب نہیں دے سکا۔', rules: 'آپ کے سوال سے متعلق پالیسی کے قواعد یہ ہیں (انگریزی میں):' },
  roman_ur: { busy: 'Hamara assistant is waqt bohat masroof hai.', failed: 'Hamara assistant is waqt jawab nahi de saka.', rules: 'Aap ke sawal se mutaliq policy ke qawaid yeh hain (English mein):' },
};

/** One plain-text answer, handy for automated graders and copy/paste. Labels follow the reply language. */
function toText(r, lang = 'en') {
  const L = TEXT_LABELS[lang] || TEXT_LABELS.en;
  if (r.status === 'clarify') return r.question;
  if (r.status === 'fallback') return [r.message, ...(r.sources || []).map(s => `${s.source}: ${s.text}`)].join('\n');
  if (r.status !== 'answer') return r.message;
  const lines = [];
  for (const p of r.parts) {
    const head = r.parts.length > 1 ? `• ${p.question}: ` : '';
    if (p.status === 'not_covered') lines.push(`${head}${NOT_COVERED_TEXT[lang] || NOT_COVERED}`);
    else lines.push(`${head}${p.answer} (${L.source}: ${[...new Set(p.citations.map(c => c.source))].join('; ')})`);
  }
  if (r.calculation.length) {
    lines.push(`${L.calculation}:`);
    r.calculation.forEach((c, i) => lines.push(`${i + 1}. ${c.label}: ${c.expression} = Rs. ${c.result.toLocaleString('en-US')}${c.source ? ` (${c.source})` : ''}`));
  }
  if (r.rules.length) lines.push(`${L.rules}: ` + r.rules.map(x => `${x.order}) ${x.rule} [${x.source}]${x.why.trim() ? ` ${L.because} ${x.why.trim()}` : ''}`).join(' '));
  if (r.date_notes?.length) lines.push(`${L.dates}: ` + r.date_notes.join('; '));
  if (r.version_note) lines.push(`${L.note}: ${r.version_note}`);
  if (r.calcError) lines.push(r.calcError);
  if (r.translation_note) lines.push(r.translation_note);
  return lines.join('\n');
}

/**
 * A calculation step whose result nothing uses (no later step, no {{placeholder}} in an answer) is almost
 * always a mistake, e.g. a return fee worked out and then never subtracted. Steps equal to 0 are harmless.
 */
export function unusedSteps(results, answers) {
  const answerText = answers.join(' ');
  return results.filter((s, k) => {
    if (!s.result) return false;
    const used = new RegExp(`(^|[^a-z0-9_])${s.name}([^a-z0-9_]|$)`, 'i');
    const inLater = results.slice(k + 1).some(x => used.test(x.expression));
    const inAnswer = new RegExp(`\\{\\{\\s*${s.name}\\s*\\}\\}`, 'i').test(answerText);
    return !inLater && !inAnswer;
  });
}

function fallbackAnswer(items, err) {
  const top = items.filter(it => !it.id.startsWith('00:')).slice(0, 3);
  return { status: 'fallback', busy: isRateLimit(err), sources: top.map(it => ({ source: citeLabel(it), text: it.text })) };
}

export async function answerQuestion(rawQuestion, rawHistory) {
  const t0 = Date.now();
  const meta = { ai_calls: 0, tokens: 0, providers: [], semantic_search: false };
  let key = null;
  // Language: code-only first guess (exact for Urdu script); refined by the extractor AI below for Roman Urdu.
  let lang = detectLanguage(rawQuestion);

  // Finish a result: fixed texts in the reply language (no AI), translation of a verified answer
  // (only for Urdu / Roman Urdu), plain-text answer, meta and cache. A failed translation is never cached.
  const done = async (r, cache = true) => {
    r.language = lang;
    r.not_covered_text = NOT_COVERED_TEXT[lang];
    if (r.status === 'not_covered') r.message = NOT_COVERED_TEXT[lang];
    const fixedText = L => `${r.busy ? L.busy : L.failed} ${L.rules}`;
    if (r.status === 'fallback') r.message = fixedText(FALLBACK_TEXT.en);
    r.answer_en = toText(r, 'en'); // English original, before any translation
    if (r.status === 'fallback') { r.message = fixedText(FALLBACK_TEXT[lang]); delete r.busy; }
    let translationFailed = false;
    if (lang !== 'en' && (r.status === 'answer' || r.status === 'clarify')) {
      const tr = await translateResult(r, lang);
      if (tr.provider) { meta.ai_calls++; meta.tokens += tr.tokens || 0; meta.providers.push(`translate:${tr.provider}/${tr.model}`); }
      translationFailed = !tr.ok;
    }
    r.answer = toText(r, lang);
    r.meta = { ...meta, ms: Date.now() - t0 };
    if (cache && key && !translationFailed) setCached(key, r);
    return r;
  };

  // 1. Validate (Urdu / Persian digits become 0-9 first, so dates and Rs amounts parse)
  const v = validateQuestion(typeof rawQuestion === 'string' ? normalizeDigits(rawQuestion) : rawQuestion, lang);
  if (!v.ok) return { status: 'error', message: v.error, answer: v.error, language: lang, meta: { ai_calls: 0, ms: Date.now() - t0 } };
  const history = cleanHistory(Array.isArray(rawHistory) ? rawHistory.map(h => (h && typeof h.text === 'string' ? { ...h, text: normalizeDigits(h.text) } : h)) : rawHistory);

  // 2. Cache (language is part of the key, so two languages never share an answer)
  key = makeKey({ q: v.question, h: history, lang });
  const hit = getCached(key);
  if (hit) return { ...hit, meta: { ...hit.meta, cached: true, ms: Date.now() - t0 } };

  // 3. Extract facts (AI call 1) AND embed the question, at the same time (no extra wait)
  const userText = history.filter(h => h.role === 'user').map(h => h.text).join(' ');
  const [ex, qvec] = await Promise.all([
    extractFacts(v.question, history),
    embedQuery(`${userText} ${v.question}`.trim()),
  ]);
  meta.semantic_search = !!qvec;
  if (!ex.usedFallback) { meta.ai_calls++; meta.tokens += ex.tokens || 0; }
  meta.providers.push(`extract:${ex.provider}`);
  const facts = ex.facts;
  // Urdu script is exact in code; Roman Urdu comes from the extractor (word-list backup if the AI was down)
  lang = chooseLanguage(v.question, ex.usedFallback ? null : facts.language);
  facts.region_class = classifyRegion(`${facts.place || ''} ${v.question}`, facts.region_class); // Urdu place names handled inside

  // 4. Resolve which files apply (code)
  const resolved = resolvePolicies({ contactDate: facts.contact_date, region: facts.region_class });

  // 5. Date facts (code). Relative dates the extractor worked out ("yesterday") are listed first,
  // so the model knows they were assumed and can tell the customer.
  const dateNotes = facts.date_notes || [];
  const dateFacts = [...dateNotes.map(n => `Worked out by code: ${n}`), ...buildDateFacts(facts)];

  // 6. Retrieve items (code)
  // Keyword search needs English words: for Urdu / Roman Urdu use the extractor's English terms and sub-questions.
  // (The embedding model is multilingual, so the meaning search above already used the original text.)
  const englishQuestion = lang === 'en' ? '' : [facts.search_terms, ...(facts.sub_questions || [])].filter(Boolean).join(' ');
  const searchText = lang === 'en' ? `${userText} ${v.question} ${facts.search_terms}` : `${englishQuestion} ${userText} ${v.question}`;
  const { items, found } = retrieve(searchText, resolved.allowed, facts.topics, qvec, { maxTotal: MAX_ITEMS });
  const trace = { facts, language: lang, excluded: resolved.excluded, notices: resolved.notices, retrieved: items.map(it => it.id) };
  if (found === 0) return done({ status: 'not_covered', message: NOT_COVERED, trace });

  // 7. Reason (AI call 2) + 8/9 verify & calculate, with one repair attempt (AI call 3) if checks fail
  let repairNote = null;
  let result = null;
  let best = null; // keep whichever round had fewer problems
  for (let round = 0; round < 2; round++) {
    let ai;
    try {
      const res = await callLLM({
        role: 'main', system: SYSTEM_PROMPT, maxTokens: ANSWER_MAX_TOKENS,
        user: buildPrompt({ question: v.question, history, facts, dateFacts, notices: resolved.notices, items, repairNote, englishQuestions: lang === 'en' ? null : facts.sub_questions }),
      });
      ai = res.data; meta.ai_calls++; meta.tokens += res.tokens || 0; meta.providers.push(`answer:${res.provider}/${res.model}`);
    } catch (err) {
      console.error('[pipeline] main AI failed:', err.message);
      if (result) break; // keep the first result if the repair call fails
      return done(fallbackAnswer(items, err), false); // never cache failures
    }

    if (ai?.mode === 'clarify' && String(ai.clarifying_question || '').trim()) {
      return done({ status: 'clarify', question: String(ai.clarifying_question).trim(), trace });
    }

    const byId = new Map(items.map(it => [it.id, it]));
    const steps = (Array.isArray(ai?.calculation) ? ai.calculation : []).map(s => {
      const id = String(s?.id || '').trim().replace(/^\[|\]$/g, '');
      return { name: s?.name, label: s?.label, expression: s?.expression, id: byId.has(id) ? id : null };
    });
    let calc = { results: [], values: {} };
    let calcError = null;
    if (steps.length) {
      try { calc = runCalculation(steps); } catch (e) { calcError = e.message; }
    }
    const checked = verifyAnswer(ai, items, `${v.question} ${history.map(h => h.text).join(' ')} ${dateFacts.join(' ')}`);
    const parts = checked.parts.map(p => ({ ...p, answer: fillPlaceholders(p.answer, calc.values) }));
    const candidate = {
      status: parts.some(p => p.status !== 'not_covered') ? 'answer' : 'not_covered',
      parts,
      calculation: calc.results.map(c => ({ ...c, source: c.id && byId.has(c.id) ? citeLabel(byId.get(c.id)) : null })),
      rules: checked.rules,
      version_note: String(ai?.version_note || '').trim(),
      date_notes: dateNotes,
      calcError: calcError ? 'I could not safely calculate the exact amount. Please contact NovaCart support for the figure.' : null,
      checks: checked.issues,
      trace,
    };
    if (candidate.status === 'not_covered') candidate.message = NOT_COVERED;

    const unfilled = parts.some(p => p.answer.includes('[could not calculate]'));
    const unused = unusedSteps(calc.results, checked.parts.map(p => p.answer));
    const problems = [
      ...checked.issues,
      ...(calcError ? [`calculation error: ${calcError}`] : []),
      ...(unfilled ? ['an answer used a {{name}} that is not a calculation step'] : []),
      ...unused.map(s => `calculation step "${s.name}" (${s.result}) is worked out but never used by a later step or the answer: a rule was probably left out of the formula`),
    ];
    if (!best || problems.length < best.problems) best = { result: candidate, problems: problems.length };
    result = best.result;
    if (!problems.length || round === 1) break;
    repairNote = problems.join('; ');
    meta.repaired = true;
  }
  // Safety net: a number that is STILL unverified after the repair is never shown to the customer.
  // Its sentence is removed; the code calculation (if any) gives the real figure.
  let removed = 0;
  const emptied = result.calculation.length ? 'Please see the calculation below.' : 'I could not confirm this part safely. Please contact NovaCart support.';
  result.parts = result.parts.map(p => {
    const d = dropUnverifiedSentences(p.answer, p.unverified);
    removed += d.removed;
    return { ...p, answer: d.answer || emptied };
  });
  if (removed) meta.sentences_removed = removed;
  if (result.parts.some(p => p.answer.includes('[could not calculate]'))) {
    result.calcError ??= 'I could not safely calculate the exact amount. Please contact NovaCart support for the figure.';
  }
  // Cache only answers that passed every check, so a bad round (e.g. under rate limits) is retried next time
  return done(result, best.problems === 0);
}
