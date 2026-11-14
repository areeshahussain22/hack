// Meaning-based search: compares the question's vector with each policy item's vector.
// Never throws: if anything fails it returns null and keyword search carries on alone.
import STORE from './policy-embeddings.js';

const MODEL = STORE.model;
const DIMS = STORE.dims;
const cache = new Map(); // repeated questions don't cost another call
export const hasVectors = () => !!MODEL && Object.keys(STORE.vectors).length > 0;

function normalize(v) {
  const n = Math.sqrt(v.reduce((a, x) => a + x * x, 0)) || 1;
  return v.map(x => x / n);
}
const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };

export async function embedQuery(text, timeoutMs = 4000) {
  const key = process.env.GEMINI_API_KEY;
  if (!key || !hasVectors()) return null;
  const q = String(text).slice(0, 2000);
  if (cache.has(q)) return cache.get(q);
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  try {
    const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:embedContent`, {
      method: 'POST',
      signal: ctrl.signal,
      headers: { 'x-goog-api-key': key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: `models/${MODEL}`, content: { parts: [{ text: q }] }, taskType: 'RETRIEVAL_QUERY', outputDimensionality: DIMS }),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const vec = normalize((await res.json()).embedding.values);
    if (cache.size > 500) cache.delete(cache.keys().next().value);
    cache.set(q, vec);
    return vec;
  } catch (e) {
    console.warn('[embeddings] query embedding failed, keyword search only:', e.message);
    return null;
  } finally { clearTimeout(timer); }
}

/** Items ranked by meaning similarity, only from files that are in force. */
export function semanticRank(qvec, allowed) {
  if (!qvec) return [];
  return Object.entries(STORE.vectors)
    .filter(([id]) => allowed.has(id.slice(0, 2)))
    .map(([id, v]) => ({ id, score: dot(qvec, v) }))
    .sort((a, b) => b.score - a.score);
}
