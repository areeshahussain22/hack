// Exact date rules from 00_how_policies_work_together.md §1.4–1.7. The AI never counts days itself.
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/;
const DAY = 86400000;
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export function parseDate(s) {
  const m = ISO.exec(String(s || '').trim());
  if (!m) return null;
  const d = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return d.getUTCMonth() === +m[2] - 1 ? d : null; // rejects 2026-02-30
}
export const fmt = d => d.toISOString().slice(0, 10);
export const isValidDate = s => !!parseDate(s);

export function daysBetween(a, b) {
  return Math.round((parseDate(b) - parseDate(a)) / DAY);
}
export function addDays(a, n) {
  return fmt(new Date(parseDate(a).getTime() + n * DAY));
}
// §1.5: Mon–Fri, holidays not excluded, counting starts the first business day after the event.
export function addBusinessDays(a, n) {
  let d = parseDate(a);
  let left = n;
  while (left > 0) {
    d = new Date(d.getTime() + DAY);
    const wd = d.getUTCDay();
    if (wd !== 0 && wd !== 6) left--;
  }
  return fmt(d);
}
// §1.7: a month is complete on the same day of month as date A (or last day if missing).
export function fullMonths(a, b) {
  const A = parseDate(a), B = parseDate(b);
  if (B < A) return 0;
  let months = (B.getUTCFullYear() - A.getUTCFullYear()) * 12 + (B.getUTCMonth() - A.getUTCMonth());
  const lastDayOfBMonth = new Date(Date.UTC(B.getUTCFullYear(), B.getUTCMonth() + 1, 0)).getUTCDate();
  const neededDay = Math.min(A.getUTCDate(), lastDayOfBMonth);
  if (B.getUTCDate() < neededDay) months--;
  return Math.max(0, months);
}
export const weekday = a => WEEKDAYS[parseDate(a).getUTCDay()];

/** Build plain-text date facts for the AI from the extracted dates. */
export function buildDateFacts(facts) {
  const lines = [];
  const named = [
    ['contact date', facts.contact_date],
    ['order date', facts.order_date],
    ['delivery date', facts.delivery_date],
    ...(facts.other_dates || []).map(o => [o.label, o.date]),
  ].filter(([, d]) => isValidDate(d));

  for (const [label, d] of named) lines.push(`${label}: ${d} (${weekday(d)})`);

  const { contact_date: c, order_date: o, delivery_date: del } = facts;
  if (isValidDate(del) && isValidDate(c)) {
    const n = daysBetween(del, c);
    lines.push(`Days from delivery date to contact date: ${n}. A limit of N days from delivery is met only if ${n} <= N (00 §1.6).`);
    lines.push(`Full months from delivery date to contact date: ${fullMonths(del, c)} (00 §1.7).`);
  }
  if (isValidDate(o) && isValidDate(c)) lines.push(`Days from order date to contact date: ${daysBetween(o, c)}.`);
  for (const [label, d] of named) {
    const bd = [1, 2, 3, 5, 7, 10, 15, 25].map(n => `+${n}=${addBusinessDays(d, n)}`).join(', ');
    lines.push(`Business days after ${label} (00 §1.5): ${bd}`);
  }
  return lines;
}
