// Runs without API keys: checks the code-only parts of the pipeline.
// More tests are added as more modules land.
import assert from 'node:assert/strict';
import { fullMonths, addBusinessDays, daysBetween } from '../lib/dates.js';
import { splitShare, runCalculation, roundHalfUp } from '../lib/calc.js';
import { resolvePolicies, classifyRegion } from '../lib/resolver.js';
import { retrieve } from '../lib/retrieve.js';
import INDEX from '../lib/policy-index.js';
import { regexExtract, sanitize } from '../lib/extract.js';
import { verifyAnswer, quoteSupported, dropUnverifiedSentences } from '../lib/verify.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✅', name); };

t('full months follow 00 §1.7 example', () => { assert.equal(fullMonths('2026-01-10', '2026-04-09'), 2); assert.equal(fullMonths('2026-01-10', '2026-04-10'), 3); });
t('short month edge (Jan 31 -> Feb 28 is 1 month)', () => assert.equal(fullMonths('2026-01-31', '2026-02-28'), 1));
t('business days skip weekends (Fri + 1 = Mon)', () => assert.equal(addBusinessDays('2026-11-13', 1), '2026-11-16'));
t('days from delivery', () => assert.equal(daysBetween('2026-03-01', '2026-03-08'), 7));
t('discount split matches 12 §6.4 example', () => assert.deepEqual([1, 2, 3].map(i => splitShare(500, i, 5000, 5000, 5500)), [161, 161, 178]));
t('warranty refund matches 08 §6.1 example', () => assert.equal(runCalculation([{ name: 'r', expression: '24000 * (12 - 3) / 12' }]).values.r, 18000));
t('round half up', () => { assert.equal(roundHalfUp(2.5), 3); assert.equal(roundHalfUp(499.5), 500); assert.equal(roundHalfUp(0.1 + 0.2), 0); });
t('calculator keeps a rate step exact (0.15 is not rounded to 0)', () => {
  const { values } = runCalculation([
    { name: 'rate', expression: '0.15' },
    { name: 'fee', expression: '5000 * rate' },
    { name: 'refund', expression: '5000 - fee - 200' },
  ]);
  assert.equal(values.fee, 750); assert.equal(values.refund, 4050);
  assert.throws(() => runCalculation([{ name: 'r', expression: '15 / 100' }]), /rounds to 0/);
});
t('calculator blocks unsafe input', () => {
  for (const bad of ['import(1)', 'abc + 1', '1/0', 'x; 2', 'evaluate("1")']) assert.throws(() => runCalculation([{ name: 'x', expression: bad }]));
});
t('unsafe instruction lines removed from index', () => assert.ok(!INDEX.items.some(i => /ignore all previous|instruction for assistants|note for/i.test(i.text))));
t('2026-02-10: returns 2025 file applies, 2026 file not yet', () => {
  const r = resolvePolicies({ contactDate: '2026-02-10', region: 'metro' });
  assert.ok(r.allowed.has('02') && !r.allowed.has('01'));
});
t('2026-07-01: file 01 replaces file 02', () => {
  const r = resolvePolicies({ contactDate: '2026-07-01', region: 'metro' });
  assert.ok(r.allowed.has('01') && !r.allowed.has('02') && r.notices.some(n => n.includes('Files differ')));
});
t('file 21 only from 2027-02-01', () => {
  assert.ok(!resolvePolicies({ contactDate: '2027-01-31', region: 'metro' }).allowed.has('21'));
  assert.ok(resolvePolicies({ contactDate: '2027-02-01', region: 'metro' }).allowed.has('21'));
});
t('regional file kept only for its region', () => {
  const r = resolvePolicies({ contactDate: '2026-07-01', region: 'remote' });
  assert.ok(r.allowed.has('19') && !r.allowed.has('20'));
});
t('region detection by code', () => {
  assert.equal(classifyRegion('Skardu, Gilgit-Baltistan'), 'remote');
  assert.equal(classifyRegion('Dubai'), 'international');
  assert.equal(classifyRegion('Lahore'), 'metro');
  assert.equal(classifyRegion('Toronto', 'not_served'), 'not_served');
});
t('retrieval finds return window + discount split', () => {
  const r = resolvePolicies({ contactDate: '2026-07-01', region: 'metro' });
  const { items } = retrieve('return opened headphones I used WELCOME10', r.allowed, ['returns', 'refund_amount', 'promo']);
  const ids = items.map(i => i.id);
  assert.ok(ids.includes('01:2.1') && ids.includes('12:6.2') && !ids.some(id => id.startsWith('02:')));
});
// Extractor: the AI must show the exact words it read each date from (no list of date formats)
const check = (text, ai) => sanitize(ai, regexExtract(text), text);
t('extract: date kept when evidence is in the text and agrees', () => {
  const text = 'I got my order on 25th June 2026, can I return it?';
  assert.equal(check(text, { delivery_date: '2026-06-25', evidence: { delivery_date: 'on 25th June 2026' } }).delivery_date, '2026-06-25');
  assert.equal(check('arrived 25/06/2026', { delivery_date: '2026-06-25', evidence: { delivery_date: '25/06/2026' } }).delivery_date, '2026-06-25');
});
t('extract: made-up date removed (evidence not in text)', () => {
  const text = 'delivered on 2026-06-25, paid Rs. 9,000';
  const f = check(text, { contact_date: '2026-09-09', evidence: { contact_date: 'today is 9 September' } });
  assert.equal(f.contact_date, null);
});
t('extract: date removed when evidence disagrees (wrong day or year)', () => {
  const text = 'I got it on 25 June 2025';
  assert.equal(check(text, { delivery_date: '2026-06-25', evidence: { delivery_date: '25 June 2025' } }).delivery_date, null);
  assert.equal(check(text, { delivery_date: '2025-06-24', evidence: { delivery_date: '25 June 2025' } }).delivery_date, null);
});
t('extract: AI may not calculate relative dates itself', () => {
  assert.equal(check('it came yesterday', { delivery_date: '2026-06-24', evidence: { delivery_date: 'yesterday' } }).delivery_date, null);
});
t('extract: relative dates are counted by code from the contact date', () => {
  const text = 'today is 2026-07-01 (Wednesday). It arrived yesterday, I ordered it last Tuesday';
  const f = check(text, {
    contact_date: '2026-07-01',
    relative_dates: { delivery_date: { evidence: 'arrived yesterday', days_ago: 1 }, order_date: { evidence: 'last Tuesday', weekday: 'tuesday' } },
  });
  assert.equal(f.delivery_date, '2026-06-30');
  assert.equal(f.order_date, '2026-06-30'); // most recent Tuesday before Wed 2026-07-01
  assert.equal(f.date_notes.length, 2);
  assert.equal(check('today is 2026-07-01, it came 3 days ago', { contact_date: '2026-07-01', relative_dates: { delivery_date: { evidence: '3 days ago', days_ago: 3 } } }).delivery_date, '2026-06-28');
  assert.equal(check('today is 2026-07-01, it came 2 weeks ago', { contact_date: '2026-07-01', relative_dates: { delivery_date: { evidence: '2 weeks ago', days_ago: 14 } } }).delivery_date, '2026-06-17');
});
t('extract: relative dates are checked against the text', () => {
  const base = 'today is 2026-07-01, it came 3 days ago';
  const rel = r => check(base, { contact_date: '2026-07-01', relative_dates: { delivery_date: r } }).delivery_date;
  assert.equal(rel({ evidence: '3 days ago', days_ago: 5 }), null);          // number disagrees
  assert.equal(rel({ evidence: '5 days ago', days_ago: 5 }), null);          // evidence not in text
  assert.equal(rel({ evidence: '3 days ago', weekday: 'friday' }), null);    // weekday not in evidence
  // Weekday in the customer's words wins over a wrong day count from the AI
  assert.equal(check('today is 2026-07-01, got it last Tuesday', { contact_date: '2026-07-01', relative_dates: { delivery_date: { evidence: 'last Tuesday', days_ago: 2 } } }).delivery_date, '2026-06-30');
  // Same phrase for order and delivery: used for delivery only
  const same = check('today is 2026-07-01, it came 3 days ago', { contact_date: '2026-07-01', relative_dates: {
    order_date: { evidence: 'it came 3 days ago', days_ago: 3 }, delivery_date: { evidence: 'it came 3 days ago', days_ago: 3 } } });
  assert.equal(same.order_date, null); assert.equal(same.delivery_date, '2026-06-28');
  // AI counted "yesterday" itself: code recounts it (and rejects a wrong count when the words have a number)
  assert.equal(check('today is 2026-07-01, it arrived yesterday', { contact_date: '2026-07-01', delivery_date: '2026-06-30', evidence: { delivery_date: 'arrived yesterday' } }).delivery_date, '2026-06-30');
  assert.equal(check('today is 2026-07-01, it came 3 days ago', { contact_date: '2026-07-01', delivery_date: '2026-06-27', evidence: { delivery_date: '3 days ago' } }).delivery_date, null);
  // No contact date: nothing is counted, the bot asks instead
  const f = check('it came yesterday', { relative_dates: { delivery_date: { evidence: 'came yesterday', days_ago: 1 } } });
  assert.equal(f.delivery_date, null);
  assert.ok(f.date_notes[0].includes('needs the contact date'));
});
t('extract: made-up promo code and price removed', () => {
  const f = check('used WELCOME10 on headphones for Rs. 5,000', {
    promo_codes: ['WELCOME10', 'STYLE15'], items: [{ name: 'headphones', price: 5000 }, { name: 'case', price: 9999 }],
  });
  assert.deepEqual(f.promo_codes, ['WELCOME10']);
  assert.deepEqual(f.items.map(i => i.price), [5000, null]);
});
t('extract: regex backup reads order date past a price, not the delivery date', () => {
  assert.equal(regexExtract('I ordered headphones for Rs. 5,000 on 2026-06-20').order_date, '2026-06-20');
  const f = regexExtract('I ordered headphones, delivered on 2026-06-25');
  assert.equal(f.order_date, null); assert.equal(f.delivery_date, '2026-06-25'); assert.equal(f.contact_date, null);
});
t('extract: "how much is shipping" is not a refund question', () => {
  assert.ok(!regexExtract('how much is shipping to lahore').topics.includes('refund_amount'));
  assert.ok(regexExtract('how much will I get back').topics.includes('refund_amount'));
});
// Verifier: quotes must be copied word for word; numbers must come from the cited items
const ITEMS = ['01:2.1', '01:3.1', '03:3.1', '12:6.4'].map(id => INDEX.items.find(i => i.id === id));
const part = (answer, citations) => ({ parts: [{ question: 'q', status: 'covered', answer, citations }] });
const Q31 = 'a restocking fee of 15% of the paid price applies';
t('verify: exact quote passes, punctuation and case ignored', () => {
  assert.ok(quoteSupported(Q31, ITEMS[1].text));
  assert.ok(quoteSupported('A Refund goes back to the original payment method', ITEMS[2].text));
  assert.ok(quoteSupported('If an electronics item has been opened ... a restocking fee of 15%', ITEMS[1].text));
  assert.ok(quoteSupported('Clothing | 30 days', ITEMS[0].text));   // a whole table row may be short
  assert.ok(!quoteSupported('Clothing | 7 days', ITEMS[0].text));   // but not a mixed-up row
  assert.ok(!quoteSupported('7 days', ITEMS[0].text));              // and not a loose fragment
});
t('verify: reworded, reordered, too short or wrong-item quotes fail', () => {
  assert.ok(!quoteSupported('a restocking fee of 15% applies to the paid price', ITEMS[1].text)); // same words, different order
  assert.ok(!quoteSupported('restocking fee of 20% of the paid price', ITEMS[1].text));            // one word changed
  assert.ok(!quoteSupported('15% of the', ITEMS[1].text));                                         // too short to prove anything
  assert.ok(!quoteSupported(Q31, ITEMS[2].text));                                                  // right words, wrong item
  assert.ok(!quoteSupported('a restocking fee of 15% ... the original packaging', ITEMS[1].text)); // pieces out of order
});
t('verify: fake quote drops the part to not covered', () => {
  const v = verifyAnswer(part('Everyone gets a gift card.', [{ id: '01:3.1', quote: 'free gift cards for everyone' }]), ITEMS);
  assert.equal(v.parts[0].status, 'not_covered'); assert.ok(v.issues.length >= 2);
});
t('verify: numbers must come from the cited item, including small ones', () => {
  const ok = verifyAnswer(part('Opened electronics have a 15% fee. Your refund is {{refund}}.', [{ id: '01:3.1', quote: Q31 }]), ITEMS);
  assert.deepEqual(ok.issues, []);
  // "8,300" made up
  assert.ok(verifyAnswer(part('Your refund is about 8,300.', [{ id: '01:3.1', quote: Q31 }]), ITEMS).issues.some(i => i.includes('8300')));
  // single digit: "7 days" is in 01:2.1, but this part only cites 01:3.1, so it must cite 01:2.1 too
  assert.ok(verifyAnswer(part('You have 7 days to return it.', [{ id: '01:3.1', quote: Q31 }]), ITEMS).issues.some(i => i.includes('number 7')));
  assert.deepEqual(verifyAnswer(part('You have 7 days to return it.', [{ id: '01:2.1', quote: 'Return windows count from the delivery date' }]), ITEMS).issues, []);
  // wrong small number: "8 days" is nowhere
  assert.ok(verifyAnswer(part('You have 8 days.', [{ id: '01:2.1', quote: 'Return windows count from the delivery date' }]), ITEMS).issues.some(i => i.includes('number 8')));
});
t('verify: numbers copied from a worked example are not trusted', () => {
  const ex = INDEX.items.find(i => i.example && i.text.includes('1,840'));
  assert.ok(ex, 'worked example items are flagged by the indexer');
  const v = verifyAnswer(part('You will get back Rs. 1,840.', [{ id: ex.id, quote: ex.text.split(/\s+/).slice(0, 8).join(' ') }]), [...ITEMS, ex]);
  assert.ok(v.issues.some(i => i.includes('1840')));
});
t('verify: calculated amounts must be placeholders, and unverified sentences are removed', () => {
  const cite = [{ id: '01:3.1', quote: Q31 }];
  assert.deepEqual(verifyAnswer(part('You get back Rs. {{refund}}.', cite), ITEMS).issues, []);
  const v = verifyAnswer(part('Opened items have a 15% fee. You get back Rs. 2,160. Thanks!', cite), ITEMS);
  assert.deepEqual(v.parts[0].unverified, ['2160']);
  assert.equal(dropUnverifiedSentences(v.parts[0].answer, v.parts[0].unverified).answer, 'Opened items have a 15% fee. Thanks!');
});
t('verify: customer and date-fact numbers allowed, citation labels ignored', () => {
  const v = verifyAnswer(part('Delivered 2026-07-07, it is day 3 of the window (01_returns_policy.md §2.1, 01:2.1).',
    [{ id: '01:2.1', quote: 'Return windows count from the delivery date' }]), ITEMS, 'delivery date: 2026-07-07. Days from delivery date to contact date: 3.');
  assert.deepEqual(v.issues, []);
});
console.log(`\n${passed} tests passed`);
