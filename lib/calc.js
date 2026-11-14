// The AI only WRITES the math steps. This file DOES the math (00 §1.3: whole rupees, round half up at each step).
import { evaluate } from 'mathjs';

const ALLOWED_CHARS = /^[0-9a-z_\s+\-*/().,]+$/i;
const NAME = /^[a-z_][a-z0-9_]*$/i;
const FUNCS = ['min', 'max', 'split_share'];

export function roundHalfUp(v) {
  const clean = Math.round(v * 1e6) / 1e6; // remove float noise like 499.49999999
  return Math.sign(clean) * Math.round(Math.abs(clean));
}

/**
 * 12 §6.1–6.2: share of item i (1-based) in a code discount, with the leftover
 * rupee fix going to the most expensive item (first listed on a tie).
 */
export function splitShare(discount, i, ...prices) {
  const total = prices.reduce((a, b) => a + b, 0);
  if (!total || i < 1 || i > prices.length) throw new Error('split_share: bad arguments');
  const shares = prices.map(p => roundHalfUp(discount * p / total));
  const diff = discount - shares.reduce((a, b) => a + b, 0);
  if (diff !== 0) {
    let top = 0;
    prices.forEach((p, k) => { if (p > prices[top]) top = k; });
    shares[top] += diff;
  }
  return shares[i - 1];
}

export function runCalculation(steps = []) {
  const scope = { min: Math.min, max: Math.max, split_share: splitShare };
  const values = {};
  const results = [];
  steps.forEach((step, k) => {
    const name = NAME.test(step.name || '') && !FUNCS.includes(step.name) ? step.name : `step${k + 1}`;
    const expr = String(step.expression || '').trim();
    if (!expr || !ALLOWED_CHARS.test(expr)) throw new Error(`Step ${k + 1} has an invalid expression: "${expr}"`);
    for (const id of expr.match(/[a-z_][a-z0-9_]*/gi) || []) {
      if (!(id in values) && !FUNCS.includes(id)) throw new Error(`Step ${k + 1} uses unknown name "${id}"`);
    }
    const raw = evaluate(expr, { ...scope, ...values });
    if (typeof raw !== 'number' || !Number.isFinite(raw)) throw new Error(`Step ${k + 1} did not give a number`);
    const result = roundHalfUp(raw);
    values[name] = result;
    results.push({ name, label: step.label || name, expression: expr, result, id: step.id || null });
  });
  return { results, values };
}

/** Replace {{name}} placeholders with computed values, formatted like "Rs. 1,234". */
export function fillPlaceholders(text, values) {
  return String(text || '').replace(/\{\{\s*([a-z_][a-z0-9_]*)\s*\}\}/gi, (m, n) =>
    n in values ? values[n].toLocaleString('en-US') : '[could not calculate]');
}
