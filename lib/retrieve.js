// Hybrid search: keyword (BM25) + meaning (embeddings), merged with Reciprocal Rank Fusion,
// then topic sections, neighbours and cross-references are added.
import INDEX from './policy-index.js';
import { semanticRank } from './embeddings.js';

const STOP = new Set('a an the is are was were be been to of in on for and or but if my i me we you it this that with at by from can do does did have has had will would should could what when how why which who our your am its there their them they so not no yes please hi hello'.split(' '));

const SYNONYMS = {
  money: 'refund', refunded: 'refund', reimburse: 'refund', back: 'refund',
  send: 'return', exchange: 'return', returning: 'return',
  delivery: 'shipping', deliver: 'shipping', postage: 'shipping', courier: 'shipping', ship: 'shipping',
  coupon: 'code', voucher: 'code', promo: 'code', discount: 'code', offer: 'code',
  broken: 'defective', faulty: 'defective', guarantee: 'warranty', repair: 'warranty',
  card: 'payment', pay: 'payment', paid: 'payment', cod: 'cash', cash: 'cod',
  data: 'privacy', personal: 'privacy', delete: 'data', information: 'data',
  vendor: 'seller', merchant: 'seller', marketplace: 'seller',
  tax: 'gst', vat: 'gst', customs: 'international',
  phone: 'electronics', laptop: 'electronics', headphones: 'electronics', mobile: 'electronics', tv: 'electronics',
  shirt: 'clothing', jacket: 'clothing', shoes: 'clothing', dress: 'clothing', trousers: 'clothing',
  sofa: 'bulky', table: 'bulky', bed: 'bulky', furniture: 'bulky', chair: 'bulky',
  shampoo: 'personal', cream: 'personal', perfume: 'personal', makeup: 'personal',
  food: 'grocery', fruit: 'grocery', milk: 'grocery', perishable: 'grocery',
  missing: 'lost', late: 'lost',
};

function stem(w) {
  if (w.length > 5 && w.endsWith('ing')) return w.slice(0, -3);
  if (w.length > 4 && w.endsWith('ed')) return w.slice(0, -2);
  if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) return w.slice(0, -1);
  return w;
}

export function tokenize(text) {
  const out = [];
  for (const raw of String(text).toLowerCase().split(/[^a-z0-9]+/)) {
    if (!raw || STOP.has(raw)) continue;
    const w = stem(raw);
    out.push(w);
    for (const s of [SYNONYMS[raw], SYNONYMS[w]]) if (s && s !== w) out.push(stem(s));
  }
  return out;
}

const DOCS = INDEX.items.map(it => {
  const title = INDEX.files[it.fileNo].title || '';
  const tokens = tokenize(`${title} ${it.heading} ${it.heading} ${it.text}`);
  const tf = new Map();
  tokens.forEach(t => tf.set(t, (tf.get(t) || 0) + 1));
  return { it, tf, len: tokens.length };
});
const AVG = DOCS.reduce((a, d) => a + d.len, 0) / DOCS.length;
const DF = new Map();
DOCS.forEach(d => d.tf.forEach((_, t) => DF.set(t, (DF.get(t) || 0) + 1)));
const BY_ID = new Map(INDEX.items.map(it => [it.id, it]));

function bm25(d, q) {
  let s = 0;
  for (const t of new Set(q)) {
    const f = d.tf.get(t);
    if (!f) continue;
    const df = DF.get(t);
    const idf = Math.log(1 + (DOCS.length - df + 0.5) / (df + 0.5));
    s += idf * (f * 2.5) / (f + 1.5 * (0.25 + 0.75 * d.len / AVG));
  }
  return s;
}

// Topic -> key sections ("01:2" = every item 2.x in file 01). Filtered later by the resolver,
// so old versions and other regions drop out automatically.
export const TOPICS = {
  returns: ['01:1', '01:2', '01:3', '01:4', '02:1', '02:2', '02:3', '02:4', '04:1', '04:2', '04:3', '19:4', '20:6'],
  refund_amount: ['01:5', '02:5', '03:2', '12:6', '13:4', '01:3', '01:4'],
  refund_timing: ['03:1', '03:3', '11:6', '20:6', '14:2'],
  cancellation: ['03:4', '12:1'],
  shipping_fee: ['06:1', '06:2', '21:1', '21:2', '19:2', '20:4', '12:5', '00:5'],
  delivery: ['05:1', '05:2', '05:3', '05:4', '19:3', '20:4'],
  lost_damaged: ['07:1', '07:2', '07:3', '05:5'],
  warranty: ['08:1', '08:2', '08:3', '08:4', '08:5', '09:1', '09:2', '09:3', '18:4', '19:5', '20:7'],
  payment: ['10:1', '10:2', '10:3', '10:4', '10:5', '20:5'],
  cod: ['11:1', '11:2', '11:3', '11:4', '11:6'],
  promo: ['12:1', '12:2', '12:3', '12:4', '12:5', '12:6'],
  sale_bundle: ['13:1', '13:2', '13:3', '13:4'],
  store_credit: ['14:1', '14:2', '14:3', '14:4', '14:5', '14:6'],
  privacy: ['15:1', '15:2', '15:3', '15:4', '15:5', '15:6', '15:7'],
  data_request: ['16:1', '16:2', '16:3', '16:4', '16:5'],
  marketplace: ['17:1', '17:6', '18:1', '18:2', '18:3', '18:4', '18:5', '18:6', '04:4'],
  international: ['20:1', '20:2', '20:3', '20:4', '20:5', '20:6', '20:7', '00:2'],
  remote: ['19:1', '19:2', '19:3', '19:4', '19:5', '00:2'],
  gst_tax: ['00:1', '20:3'],
  checkout_total: ['00:5', '06:1', '06:2', '12:3', '11:2'],
};
const topicItems = topic => (TOPICS[topic] || []).flatMap(p => {
  const [f, sec] = p.split(':');
  return INDEX.items.filter(x => x.fileNo === f && (x.item === sec || x.item.startsWith(`${sec}.`)));
});

// Conventions every money/date answer may need (00 §1 and §5).
const ALWAYS = ['00:1.3', '00:1.6', '00:5.1'];

/**
 * @param query   text to search
 * @param allowed Set of fileNos that are in force
 * @param topics  topic keys from the extractor (see TOPICS)
 * @param qvec    question vector from embeddings.js (or null: keyword only)
 * @returns items with ids like "01:2.1"
 */
export function retrieve(query, allowed, topics = [], qvec = null, { k = 14, perFile = 5, maxTotal = 60 } = {}) {
  const q = tokenize(query);
  const picked = new Map();

  // Two ranked lists over the in-force items
  const keyword = q.length
    ? DOCS.filter(d => allowed.has(d.it.fileNo)).map(d => ({ id: d.it.id, score: bm25(d, q) }))
      .filter(x => x.score > 0).sort((a, b) => b.score - a.score).slice(0, 40)
    : [];
  const semantic = semanticRank(qvec, allowed).slice(0, 40);

  // Reciprocal Rank Fusion: an item high in EITHER list scores well; high in both scores best
  const fused = new Map();
  [keyword, semantic].forEach(list => list.forEach((x, rank) => fused.set(x.id, (fused.get(x.id) || 0) + 1 / (60 + rank))));
  const ranked = [...fused.entries()].sort((a, b) => b[1] - a[1]);
  const count = {};
  for (const [id, score] of ranked) {
    const it = BY_ID.get(id);
    if ((count[it.fileNo] || 0) >= perFile) continue;
    count[it.fileNo] = (count[it.fileNo] || 0) + 1;
    picked.set(id, { ...it, score });
    if (picked.size >= k) break;
  }
  // Add the key sections for each topic the extractor found
  for (const t of topics) for (const it of topicItems(t)) {
    if (picked.size >= maxTotal) break;
    if (allowed.has(it.fileNo) && !picked.has(it.id)) picked.set(it.id, { ...it, viaTopic: t });
  }
  const found = picked.size;
  // Pull close neighbours: other items in the same section as the top hits (tables and rules often sit together)
  for (const it of [...picked.values()].slice(0, 10)) {
    const sibs = INDEX.items.filter(x => x.fileNo === it.fileNo && x.heading === it.heading && !picked.has(x.id)).slice(0, 4);
    for (const g of sibs) if (picked.size < maxTotal) picked.set(g.id, { ...g, viaSection: it.id });
  }
  // Follow cross-references, e.g. [file 12, Section 6] -> items 12:6.x
  for (const it of [...picked.values()]) {
    for (const ref of it.refs) {
      if (!allowed.has(ref.fileNo) || !ref.section) continue;
      const exact = BY_ID.get(`${ref.fileNo}:${ref.section}`);
      const group = exact ? [exact] : INDEX.items.filter(x => x.fileNo === ref.fileNo && x.item.startsWith(`${ref.section}.`)).slice(0, 3);
      for (const g of group) if (picked.size < maxTotal && !picked.has(g.id)) picked.set(g.id, { ...g, viaRef: it.id });
    }
  }
  if (found > 0) for (const id of ALWAYS) if (!picked.has(id) && BY_ID.has(id)) picked.set(id, BY_ID.get(id));
  return { items: [...picked.values()], found };
}

export function citeLabel(it) {
  return `${it.file} §${it.item}`;
}
export const getItem = id => BY_ID.get(id);
