// Input checks: empty, junk, very long or wrong-type input never crashes the app.
export const MAX_QUESTION = 4000; // about 1,000 tokens: room for long, messy customer messages
const MAX_TURNS = 6;

function clean(s) {
  return String(s)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, ' ') // control chars
    .replace(/\s+/g, ' ')
    .trim();
}

const ERRORS = {
  en: {
    missing: 'Please type a question.',
    type: 'Please send your question as plain text.',
    empty: 'Your question is empty. Please ask something about our store policies.',
    unreadable: 'I could not read a question there. Please type it in words.',
    short: 'That is too short. Could you add a bit more detail?',
    long: `Your message is too long (max ${MAX_QUESTION} characters). Please shorten it.`,
  },
  ur: {
    missing: 'براہِ کرم اپنا سوال لکھیں۔',
    type: 'براہِ کرم اپنا سوال سادہ تحریر میں بھیجیں۔',
    empty: 'آپ کا سوال خالی ہے۔ براہِ کرم ہماری اسٹور پالیسی کے بارے میں کچھ پوچھیں۔',
    unreadable: 'مجھے سوال سمجھ نہیں آیا۔ براہِ کرم الفاظ میں لکھیں۔',
    short: 'یہ بہت مختصر ہے۔ براہِ کرم تھوڑی اور تفصیل لکھیں۔',
    long: `آپ کا پیغام بہت لمبا ہے (زیادہ سے زیادہ ${MAX_QUESTION} حروف)۔ براہِ کرم اسے مختصر کریں۔`,
  },
  roman_ur: {
    missing: 'Meharbani karke apna sawal likhein.',
    type: 'Meharbani karke apna sawal saada text mein bhejein.',
    empty: 'Aap ka sawal khali hai. Meharbani karke hamari store policy ke baare mein kuch poochein.',
    unreadable: 'Mujhe sawal samajh nahi aaya. Meharbani karke alfaaz mein likhein.',
    short: 'Yeh bohat chhota hai. Meharbani karke thori aur tafseel likhein.',
    long: `Aap ka paigham bohat lamba hai (zyada se zyada ${MAX_QUESTION} huroof). Meharbani karke isay chhota karein.`,
  },
};

/** @param lang 'en' | 'ur' | 'roman_ur': language of the error message */
export function validateQuestion(input, lang = 'en') {
  const E = ERRORS[lang] || ERRORS.en;
  if (input === undefined || input === null) return { ok: false, error: E.missing };
  if (typeof input !== 'string' && typeof input !== 'number') return { ok: false, error: E.type };
  const q = clean(input);
  if (!q) return { ok: false, error: E.empty };
  if (!/[\p{L}\p{N}]/u.test(q)) return { ok: false, error: E.unreadable }; // \p{L} includes Urdu letters
  if (q.length < 3) return { ok: false, error: E.short };
  if (q.length > MAX_QUESTION) return { ok: false, error: E.long };
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
