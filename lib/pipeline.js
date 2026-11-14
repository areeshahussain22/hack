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

// Groq free tier: gpt-oss-120b allows 8,000 tokens per minute, counting the prompt PLUS max_tokens.
// About 40 items (~3,000 tokens) + system prompt (~800) + 3,000 for the reply stays under it.
const MAX_ITEMS = 40;
const ANSWER_MAX_TOKENS = 3000;
import { runCalculation, fillPlaceholders } from './calc.js';

export const NOT_COVERED = 'This is not covered in the NovaCart policy files, so I cannot answer it. Please contact NovaCart support.';

/** One plain-text answer, handy for automated graders and copy/paste. */
function toText(r) {
  if (r.status === 'clarify') return r.question;
  if (r.status !== 'answer') return r.message;
  const lines = [];
  for (const p of r.parts) {
    const head = r.parts.length > 1 ? `• ${p.question}: ` : '';
    if (p.status === 'not_covered') lines.push(`${head}${NOT_COVERED}`);
    else lines.push(`${head}${p.answer} (Source: ${[...new Set(p.citations.map(c => c.source))].join('; ')})`);
  }
  if (r.calculation.length) {
    lines.push('Calculation:');
    r.calculation.forEach((c, i) => lines.push(`${i + 1}. ${c.label}: ${c.expression} = Rs. ${c.result.toLocaleString('en-US')}${c.source ? ` (${c.source})` : ''}`));
  }
  if (r.rules.length) lines.push('Rules applied in order: ' + r.rules.map(x => `${x.order}) ${x.rule} [${x.source}]${x.why.trim() ? ` because ${x.why.trim()}` : ''}`).join(' '));
  if (r.date_notes?.length) lines.push('Dates I worked out: ' + r.date_notes.join('; '));
  if (r.version_note) lines.push(`Note: ${r.version_note}`);
  if (r.calcError) lines.push(r.calcError);
  return lines.join('\n');
}

function fallbackAnswer(items, err) {
  const top = items.filter(it => !it.id.startsWith('00:')).slice(0, 3);
  const r = {
    status: 'fallback',
    message: (isRateLimit(err) ? 'Our assistant is very busy right now.' : 'Our assistant could not answer right now.') +
      ' Here are the policy rules most related to your question:',
    sources: top.map(it => ({ source: citeLabel(it), text: it.text })),
  };
  r.answer = r.message + '\n' + r.sources.map(s => `${s.source}: ${s.text}`).join('\n');
  return r;
}

export async function answerQuestion(rawQuestion, rawHistory) {
  const t0 = Date.now();
  const meta = { ai_calls: 0, tokens: 0, providers: [], semantic_search: false };
  let key = null;
  const done = (r, cache = true) => {
    r.answer ??= toText(r);
    r.meta = { ...meta, ms: Date.now() - t0 };
    if (cache && key) setCached(key, r);
    return r;
  };

  // 1. Validate
  const v = validateQuestion(rawQuestion);
  if (!v.ok) return { status: 'error', message: v.error, answer: v.error, meta: { ai_calls: 0, ms: Date.now() - t0 } };
  const history = cleanHistory(rawHistory);

  // 2. Cache
  key = makeKey({ q: v.question, h: history });
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
  facts.region_class = classifyRegion(`${facts.place || ''} ${v.question}`, facts.region_class);

  // 4. Resolve which files apply (code)
  const resolved = resolvePolicies({ contactDate: facts.contact_date, region: facts.region_class });

  // 5. Date facts (code). Relative dates the extractor worked out ("yesterday") are listed first,
  // so the model knows they were assumed and can tell the customer.
  const dateNotes = facts.date_notes || [];
  const dateFacts = [...dateNotes.map(n => `Worked out by code: ${n}`), ...buildDateFacts(facts)];

  // 6. Retrieve items (code)
  const { items, found } = retrieve(`${userText} ${v.question} ${facts.search_terms}`, resolved.allowed, facts.topics, qvec, { maxTotal: MAX_ITEMS });
  const trace = { facts, excluded: resolved.excluded, notices: resolved.notices, retrieved: items.map(it => it.id) };
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
        user: buildPrompt({ question: v.question, history, facts, dateFacts, notices: resolved.notices, items, repairNote }),
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
    const problems = [...checked.issues, ...(calcError ? [`calculation error: ${calcError}`] : []), ...(unfilled ? ['an answer used a {{name}} that is not a calculation step'] : [])];
    if (!best || problems.length < best.problems) best = { result: candidate, problems: problems.length };
    result = best.result;
    if (!problems.length || round === 1) break;
    repairNote = problems.join('; ');
    meta.repaired = true;
  }
  // Safety net: a number that is STILL unverified after the repair is never shown to the customer.
  // Its sentence is removed; the code calculation (if any) gives the real figure.
  let removed = 0;
  result.parts = result.parts.map(p => {
    const d = dropUnverifiedSentences(p.answer, p.unverified);
    removed += d.removed;
    return { ...p, answer: d.answer || 'Please see the calculation below.' };
  });
  if (removed) meta.sentences_removed = removed;
  if (result.parts.some(p => p.answer.includes('[could not calculate]'))) {
    result.calcError ??= 'I could not safely calculate the exact amount. Please contact NovaCart support for the figure.';
  }
  return done(result);
}
