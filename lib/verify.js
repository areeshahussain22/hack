// Checks the AI's answer against the real policy text. Anything unsupported is removed.
import { citeLabel } from './retrieve.js';

// Compare words only: lowercase, letters and digits, single spaces. Markdown, quote marks and
// punctuation differences are ignored, but the words and their order must be exactly the same.
const words = s => String(s || '').toLowerCase().normalize('NFKC').replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
const MIN_QUOTE_WORDS = 4;

/**
 * A quote passes only if it is copied word for word from the cited item.
 * "..." may join several copied pieces; each piece must be found, in order.
 * Very short quotes ("30 days") prove nothing, so at least 4 words are needed,
 * unless the quote is one whole line of the item, such as a table row ("Clothing | 30 days").
 */
export function quoteSupported(quote, text) {
  const hay = words(text);
  const pieces = String(quote || '').split(/\.{3}|…/).map(words).filter(Boolean);
  const total = pieces.join(' ').split(' ').filter(Boolean).length;
  if (!pieces.length) return false;
  if (total < MIN_QUOTE_WORDS) return pieces.length === 1 && String(text).split('\n').map(words).includes(pieces[0]);
  let from = 0;
  for (const p of pieces) {
    const at = (' ' + hay + ' ').indexOf(' ' + p + ' ', from);
    if (at < 0) return false;
    from = at + p.length;
  }
  return true;
}

// Every number written in an answer, as a value ("5,000" = "5000", "07" = "7").
// Our own citation labels (§2.1, 01:2.1, 01_returns_policy.md) and {{placeholders}} are not amounts.
export function numbersIn(text) {
  const t = String(text || '')
    .replace(/\{\{[^}]*\}\}/g, ' ')
    .replace(/§\s*[\d.]+/g, ' ')
    .replace(/\b\d{2}_[\w-]+\.md\b/g, ' ')
    .replace(/\b\d{2}:\d+(?:\.\d+)*\b/g, ' ');
  return (t.match(/\d[\d,]*(?:\.\d+)?/g) || []).map(n => String(Number(n.replace(/,/g, '')))).filter(n => n !== 'NaN');
}

/**
 * @param ai      the model's JSON
 * @param items   policy items that were shown to the model
 * @param context customer message + history + date facts (numbers allowed in any answer)
 * Calculated amounts must be written as {{step_name}} so code fills in the right step's result;
 * a typed number, even one that matches some step, could be the wrong step, so it is not trusted.
 */
export function verifyAnswer(ai, items, context = '') {
  const byId = new Map(items.map(it => [it.id, it]));
  const contextNumbers = new Set(numbersIn(context));
  const normId = id => String(id || '').trim().replace(/^\[|\]$/g, '');
  const issues = [];

  const parts = (Array.isArray(ai?.parts) ? ai.parts : []).map(p => {
    const status = ['covered', 'not_covered', 'conflict'].includes(p?.status) ? p.status : 'not_covered';
    const citations = (Array.isArray(p?.citations) ? p.citations : [])
      .map(c => ({ id: normId(c?.id), quote: String(c?.quote || '').slice(0, 300) }))
      .filter(c => {
        const it = byId.get(c.id);
        if (!it) { issues.push(`citation ${c.id || '(empty)'} is not one of the policy items given`); return false; }
        if (!quoteSupported(c.quote, it.text)) { issues.push(`the quote for ${c.id} is not copied word for word from that item (copy at least ${MIN_QUOTE_WORDS} exact words)`); return false; }
        return true;
      })
      .map(c => ({ ...c, source: citeLabel(byId.get(c.id)) }));

    if (status !== 'not_covered' && citations.length === 0) {
      issues.push(`part "${String(p?.question).slice(0, 60)}" had no valid source`);
      return { question: String(p?.question || ''), status: 'not_covered', answer: '', citations: [], downgraded: true };
    }
    const answer = status === 'not_covered' ? '' : String(p?.answer || '');
    // Numbers must come from the items THIS part cites (not just any item shown), the customer, or the date facts.
    // Checking against the cited items keeps the check strict even for small numbers like "7 days".
    // Worked examples (marked "illustration only" in the policy files) use made-up prices,
    // so their numbers never verify an amount in a real answer.
    const citedNumbers = new Set(numbersIn(citations.map(c => byId.get(c.id)).filter(it => !it.example).map(it => it.text).join(' ')));
    const unverified = [...new Set(numbersIn(answer))].filter(n => !citedNumbers.has(n) && !contextNumbers.has(n));
    for (const n of unverified) {
      issues.push(`number ${n} in the answer to "${String(p?.question).slice(0, 40)}" is not in the items it cites, the customer's message or the date facts (write a calculated amount ONLY as {{step_name}}, never as a number; or cite the item a policy number comes from)`);
    }
    return { question: String(p?.question || ''), status, answer, citations, unverified };
  });

  const rules = (Array.isArray(ai?.rules_applied) ? ai.rules_applied : [])
    .filter(r => byId.has(normId(r?.id)))
    .map(r => ({ order: Number(r.order) || 0, rule: String(r.rule || ''), why: String(r.why || ''), source: citeLabel(byId.get(normId(r.id))) }))
    .sort((a, b) => a.order - b.order);

  const calculation = (Array.isArray(ai?.calculation) ? ai.calculation : []).map(s => ({
    name: s?.name, label: s?.label, expression: s?.expression, id: byId.has(normId(s?.id)) ? normId(s.id) : null,
  }));
  return { parts, rules, calculation, issues };
}

/**
 * Last safety net: remove any sentence that still has a number no check could confirm,
 * so a wrong amount never reaches the customer. The code calculation is shown instead.
 */
export function dropUnverifiedSentences(answer, unverified = []) {
  if (!unverified.length) return { answer, removed: 0 };
  const bad = new Set(unverified);
  const sentences = String(answer).split(/(?<=[.!?])\s+(?=[A-Z{(])/);
  const kept = sentences.filter(s => !numbersIn(s).some(n => bad.has(n)));
  return { answer: kept.join(' '), removed: sentences.length - kept.length };
}
