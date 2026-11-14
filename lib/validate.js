// Input checks: empty, junk, very long or wrong-type input never crashes the app.
export const MAX_QUESTION = 4000; // about 1,000 tokens: room for long, messy customer messages
const MAX_TURNS = 6;

function clean(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ') // control chars
    .replace(/\s+/g, ' ')
    .trim();
}

export function validateQuestion(input) {
  if (input === undefined || input === null) return { ok: false, error: 'Please type a question.' };
  if (typeof input !== 'string' && typeof input !== 'number')
    return { ok: false, error: 'Please send your question as plain text.' };
  const q = clean(input);
  if (!q) return { ok: false, error: 'Your question is empty. Please ask something about our store policies.' };
  if (!/[\p{L}\p{N}]/u.test(q)) return { ok: false, error: 'I could not read a question there. Please type it in words.' };
  if (q.length < 3) return { ok: false, error: 'That is too short. Could you add a bit more detail?' };
  if (q.length > MAX_QUESTION)
    return { ok: false, error: `Your message is too long (max ${MAX_QUESTION} characters). Please shorten it.` };
  return { ok: true, question: q };
}

// History = earlier turns, so the bot can use the answer to its clarifying question.
export function cleanHistory(history) {
  if (!Array.isArray(history)) return [];
  return history
    .filter(h => h && typeof h.text === 'string' && ['user', 'bot', 'assistant'].includes(h.role))
    .slice(-MAX_TURNS)
    .map(h => ({ role: h.role === 'user' ? 'user' : 'bot', text: clean(h.text).slice(0, 1500) }))
    .filter(h => h.text);
}
