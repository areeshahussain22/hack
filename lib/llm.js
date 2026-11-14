// One function for all AI calls: Groq first (fast), Gemini as fallback.
// - Retries 429/5xx with exponential backoff + jitter (honours Retry-After)
// - Circuit breaker: after Groq fails, skip it for 60 s so users don't wait on retries
// - Always returns parsed JSON or throws
import { GoogleGenAI } from '@google/genai';

const TIMEOUT_MS = 25000; // reasoning models may think for several seconds
const BREAKER_MS = 60000;
const brokenUntil = {}; // model -> timestamp
const sleep = ms => new Promise(r => setTimeout(r, ms));

export class LLMError extends Error {
  constructor(message, { status, retryAfterMs, provider } = {}) {
    super(message);
    this.status = status; this.retryAfterMs = retryAfterMs; this.provider = provider;
  }
}
export const isRateLimit = e => e?.status === 429 || /429|rate.?limit|RESOURCE_EXHAUSTED|quota/i.test(String(e?.message));
const isRetryable = e => isRateLimit(e) || [500, 502, 503, 504].includes(e?.status) ||
  /timeout|aborted|fetch failed|ECONNRESET|ETIMEDOUT|UNAVAILABLE|overloaded/i.test(String(e?.message));

function parseJSON(text) {
  const t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```$/, '');
  try { return JSON.parse(t); } catch {
    const m = t.match(/\{[\s\S]*\}/); // last resort: first {...} block
    if (m) return JSON.parse(m[0]);
    throw new LLMError('AI returned invalid JSON');
  }
}

async function callGroq(model, system, user, maxTokens, effort) {
  const key = process.env.GROQ_API_KEY;
  if (!key) throw new LLMError('GROQ_API_KEY missing', { status: 401, provider: 'groq' });
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), TIMEOUT_MS);
  try {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      signal: ctrl.signal,
      headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model,
        temperature: 0,
        max_tokens: maxTokens, // includes reasoning tokens on GPT-OSS, so keep it generous
        response_format: { type: 'json_object' },
        ...(model.includes('gpt-oss') ? { reasoning_effort: effort } : {}),
        messages: [{ role: 'system', content: system }, { role: 'user', content: user }],
      }),
    });
    if (!res.ok) {
      const retryAfter = Number(res.headers.get('retry-after'));
      const body = await res.text().catch(() => '');
      throw new LLMError(`Groq ${res.status}: ${body.slice(0, 200)}`, {
        status: res.status, provider: 'groq', retryAfterMs: Number.isFinite(retryAfter) ? retryAfter * 1000 : undefined,
      });
    }
    const data = await res.json();
    const choice = data.choices?.[0];
    if (choice?.finish_reason === 'length') throw new LLMError('Groq answer was cut off (max_tokens)', { provider: 'groq' });
    return { json: parseJSON(choice?.message?.content), tokens: data.usage?.total_tokens ?? null };
  } finally { clearTimeout(timer); }
}

let gemini;
async function callGemini(model, system, user, maxTokens) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) throw new LLMError('GEMINI_API_KEY missing', { status: 401, provider: 'gemini' });
  gemini ??= new GoogleGenAI({ apiKey: key, apiVersion: 'v1beta' }); // v1 rejects systemInstruction
  const req = gemini.models.generateContent({
    model,
    contents: user,
    config: { systemInstruction: system, responseMimeType: 'application/json', temperature: 0, maxOutputTokens: maxTokens },
  });
  const timeout = new Promise((_, rej) => setTimeout(() => rej(new LLMError('Gemini timeout', { provider: 'gemini' })), TIMEOUT_MS));
  try {
    const res = await Promise.race([req, timeout]);
    return { json: parseJSON(res.text), tokens: res.usageMetadata?.totalTokenCount ?? null };
  } catch (e) {
    if (e instanceof LLMError) throw e;
    throw new LLMError(`Gemini: ${e?.message}`, { status: e?.status, provider: 'gemini' });
  }
}

// Models: GPT-OSS on Groq (llama-3.3-70b-versatile was retired from Groq's free tier in 2026).
// fast = small model for extraction, main = strongest model for multi-rule reasoning.
function plan(role) {
  const groqModel = role === 'fast'
    ? process.env.GROQ_FAST_MODEL || 'openai/gpt-oss-20b'
    : process.env.GROQ_MAIN_MODEL || 'openai/gpt-oss-120b';
  const geminiModel = process.env.GEMINI_MODEL || 'gemini-2.5-flash-lite';
  return [
    { provider: 'groq', model: groqModel, fn: callGroq, retries: 2 },
    { provider: 'gemini', model: geminiModel, fn: callGemini, retries: 3 },
  ];
}

/**
 * @param role 'fast' (extraction) or 'main' (reasoning)
 * @returns { data, provider, model, tokens, ms }
 */
export async function callLLM({ role, system, user, maxTokens = 4000 }) {
  const effort = role === 'fast' ? 'low' : 'medium'; // think more only where it matters
  let lastErr;
  for (const step of plan(role)) {
    if ((brokenUntil[step.model] || 0) > Date.now()) continue; // breaker open
    for (let attempt = 0; attempt <= step.retries; attempt++) {
      try {
        const t0 = Date.now();
        const { json, tokens } = await step.fn(step.model, system, user, maxTokens, effort);
        return { data: json, provider: step.provider, model: step.model, tokens, ms: Date.now() - t0 };
      } catch (err) {
        lastErr = err;
        const authProblem = err?.status === 401 || err?.status === 403;
        if (authProblem || !isRetryable(err) || attempt === step.retries) {
          if (isRateLimit(err) || authProblem) brokenUntil[step.model] = Date.now() + BREAKER_MS;
          console.warn(`[llm] ${step.provider}/${step.model} gave up: ${err.message}`);
          break; // move to next provider
        }
        const backoff = Math.min(4000, (err.retryAfterMs ?? 500 * 2 ** attempt)) + Math.random() * 250;
        console.warn(`[llm] ${step.provider} retry ${attempt + 1} in ${Math.round(backoff)}ms: ${err.message}`);
        await sleep(backoff);
      }
    }
  }
  throw lastErr || new LLMError('No AI provider available');
}

export function providerStatus() {
  const now = Date.now();
  return {
    groq: { configured: !!process.env.GROQ_API_KEY },
    gemini: { configured: !!process.env.GEMINI_API_KEY },
    paused_models: Object.entries(brokenUntil).filter(([, t]) => t > now).map(([m, t]) => ({ model: m, seconds_left: Math.round((t - now) / 1000) })),
  };
}
