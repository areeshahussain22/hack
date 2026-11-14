// Translates the customer-facing text of a VERIFIED English answer into Urdu or Roman Urdu.
// Runs only for Urdu / Roman Urdu questions (1 extra AI call). Reasoning, citations, quotes and
// maths stay in English; a translated string is used only if every number in it is unchanged.
import { callLLM } from './llm.js';
import { numbersIn } from './verify.js';
import { normalizeDigits, TRANSLATION_NOTE, PARTIAL_TRANSLATION_NOTE } from './lang.js';

const TARGET = {
  ur: 'natural, simple Urdu written in Urdu script (اردو)',
  roman_ur: 'natural, simple Roman Urdu (Urdu written in Latin letters, the way people text in Pakistan, e.g. "Aap ko Rs. 1,960 wapas milenge")',
};

const SYSTEM = lang => `You translate customer-support replies for the online store NovaCart from English into ${TARGET[lang]}.
You get a JSON object of id -> English string. Return ONLY a JSON object with exactly the same ids, each value translated.
Rules:
- Keep EXACTLY as written, in Latin letters and Western digits (0-9): every number, every "Rs." amount (e.g. "Rs. 1,840"),
  dates (YYYY-MM-DD), promo codes (e.g. STYLE15, WELCOME10, TECH500, FREESHIP), file names (e.g. 01_returns_policy.md),
  section numbers (e.g. "Section 2.1", "§2.1") and the name "NovaCart".
- Never write a number in words or in Urdu digits. Never add, remove, round or change a number.
- Do not add, remove or soften any information. Do not add advice or greetings.
- Keep it short and friendly.`;

/** Multiset of numbers (as values) in a string, after turning Urdu digits into ASCII. */
function numberBag(s) {
  const bag = new Map();
  for (const n of numbersIn(normalizeDigits(s))) bag.set(n, (bag.get(n) || 0) + 1);
  return bag;
}

/** True if the translation has exactly the same numbers, the same number of times, as the English. */
export function numbersPreserved(en, translated) {
  const a = numberBag(en), b = numberBag(translated);
  if (a.size !== b.size) return false;
  for (const [n, c] of a) if (b.get(n) !== c) return false;
  return true;
}

// Customer-facing strings only. Citations, quotes, file names, calculation expressions and sources stay English.
function collect(r) {
  const out = {};
  if (r.status === 'clarify' && r.question) out.clarify = r.question;
  (r.parts || []).forEach((p, i) => {
    if (p.question) out[`p${i}q`] = p.question;
    if (p.status !== 'not_covered' && p.answer) out[`p${i}a`] = p.answer;
  });
  if (r.version_note) out.version_note = r.version_note;
  if (r.calcError) out.calcError = r.calcError;
  (r.rules || []).forEach((x, i) => { if (x.why) out[`r${i}why`] = x.why; });
  return out;
}

function apply(r, ids, tr) {
  const pick = id => (id in tr ? tr[id] : null);
  if (pick('clarify') != null) r.question = pick('clarify');
  (r.parts || []).forEach((p, i) => {
    if (pick(`p${i}q`) != null) p.question = pick(`p${i}q`);
    if (pick(`p${i}a`) != null) p.answer = pick(`p${i}a`);
  });
  if (pick('version_note') != null) r.version_note = pick('version_note');
  if (pick('calcError') != null) r.calcError = pick('calcError');
  (r.rules || []).forEach((x, i) => { if (pick(`r${i}why`) != null) x.why = pick(`r${i}why`); });
}

/**
 * @returns { result, ok, provider, model, tokens } - ok=false means some or all text stayed English
 * (result.translation_note then explains it to the customer). Never throws.
 */
export async function translateResult(result, lang) {
  const strings = collect(result);
  const ids = Object.keys(strings);
  if (!TARGET[lang] || !ids.length) return { result, ok: true, called: false };
  let data, provider = null, model = null, tokens = 0;
  try {
    const res = await callLLM({ role: 'translate', system: SYSTEM(lang), user: JSON.stringify(strings), maxTokens: 2500 });
    data = res.data; provider = res.provider; model = res.model; tokens = res.tokens || 0;
  } catch (e) {
    console.warn('[translate] failed, keeping English:', e.message);
    result.translation_note = TRANSLATION_NOTE[lang];
    return { result, ok: false, called: true };
  }
  // Safety check in code: use a translated string only if it is a non-empty string with the same numbers
  const good = {};
  let kept = 0;
  for (const id of ids) {
    const t = data?.[id];
    if (typeof t === 'string' && t.trim() && numbersPreserved(strings[id], t)) good[id] = normalizeDigits(t).trim();
    else kept++;
  }
  apply(result, ids, good);
  if (kept === ids.length) result.translation_note = TRANSLATION_NOTE[lang];
  else if (kept) result.translation_note = PARTIAL_TRANSLATION_NOTE[lang];
  return { result, ok: kept === 0, called: true, provider, model, tokens };
}
