// In-memory answer cache: the same question (and history) is answered with 0 AI calls.
// Note: on Vercel it only lives while the server instance is warm. That is fine for a demo;
// a real shop would use a shared store such as Redis.
const store = new Map();
const TTL_MS = 60 * 60 * 1000; // 1 hour
const MAX_ITEMS = 500;

// Same meaning, same key: ignore case, extra spaces and trailing punctuation
export function makeKey(obj) {
  return JSON.stringify(obj).toLowerCase().replace(/\s+/g, ' ').replace(/[?!.\s]+"/g, '"');
}

export function getCached(key) {
  const hit = store.get(key);
  if (!hit) return null;
  if (Date.now() - hit.time > TTL_MS) { store.delete(key); return null; }
  store.delete(key); store.set(key, hit); // move to newest (LRU)
  return structuredClone(hit.value);
}

export function setCached(key, value) {
  if (store.size >= MAX_ITEMS) store.delete(store.keys().next().value); // drop least recently used
  store.set(key, { value: structuredClone(value), time: Date.now() });
}
