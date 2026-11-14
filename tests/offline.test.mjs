// Runs without API keys: checks the code-only parts of the pipeline.
// More tests are added as more modules land.
import assert from 'node:assert/strict';
import { fullMonths, addBusinessDays, daysBetween } from '../lib/dates.js';
import { splitShare, runCalculation, roundHalfUp } from '../lib/calc.js';
import { resolvePolicies, classifyRegion } from '../lib/resolver.js';
import { retrieve } from '../lib/retrieve.js';
import INDEX from '../lib/policy-index.js';

let passed = 0;
const t = (name, fn) => { fn(); passed++; console.log('✅', name); };

t('full months follow 00 §1.7 example', () => { assert.equal(fullMonths('2026-01-10', '2026-04-09'), 2); assert.equal(fullMonths('2026-01-10', '2026-04-10'), 3); });
t('short month edge (Jan 31 -> Feb 28 is 1 month)', () => assert.equal(fullMonths('2026-01-31', '2026-02-28'), 1));
t('business days skip weekends (Fri + 1 = Mon)', () => assert.equal(addBusinessDays('2026-11-13', 1), '2026-11-16'));
t('days from delivery', () => assert.equal(daysBetween('2026-03-01', '2026-03-08'), 7));
t('discount split matches 12 §6.4 example', () => assert.deepEqual([1, 2, 3].map(i => splitShare(500, i, 5000, 5000, 5500)), [161, 161, 178]));
t('warranty refund matches 08 §6.1 example', () => assert.equal(runCalculation([{ name: 'r', expression: '24000 * (12 - 3) / 12' }]).values.r, 18000));
t('round half up', () => { assert.equal(roundHalfUp(2.5), 3); assert.equal(roundHalfUp(499.5), 500); assert.equal(roundHalfUp(0.1 + 0.2), 0); });
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
console.log(`\n${passed} tests passed`);
