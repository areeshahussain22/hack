# NovaCart Policy Assistant

**Tech Fusion '26 · AI Hackathon · Challenge A: Policy Q&A Bot**

A customer-support bot for **NovaCart**, a fictional online store. It answers questions using **only** the 22 policy files in `policies/`, cites the exact section for every claim, and never does its own arithmetic: every refund, fee and total is calculated by code.

Customers can ask in **English, Urdu (اردو) or Roman Urdu** and get the reply in the same language. They can also **speak** the question and have the answer **read aloud**.

---

## What it does

- **Cited answers.** Every part of an answer links to the policy item it comes from, e.g. `01_returns_policy.md §2.1`, with the quoted text.
- **Exact maths.** The AI writes the calculation steps; code runs them, rounding half up to whole rupees at each step (file 00 §1.3). The steps are shown to the customer.
- **The right policy version.** Code picks which files are in force on the customer's contact date (e.g. the 2025 vs 2026 returns policy, the 2027 shipping fees) and which regional files override the general ones (Remote areas, International).
- **Asks before guessing.** If the answer depends on a missing detail (contact date, city, item type…), it asks one short question.
- **Says "not covered"** when the policy files don't answer something, instead of making things up.
- **English, Urdu and Roman Urdu**, detected automatically. No language picker.
- **Voice:** 🎤 speak the question (Chrome / Edge), 🔊 listen to the answer.

---

## How it works

Each question goes through this pipeline (`lib/pipeline.js`):

```
question
  → validate input (empty, junk, too long, wrong type)          code
  → cache (same question = 0 AI calls)                           code
  → extract facts  ‖  embed the question (run in parallel)       AI call 1 + embedding
  → decide which policy files are in force                       code
  → work out date facts (days, business days, full months)       code
  → hybrid search: keywords (BM25) + meaning (embeddings)        code
  → write the answer as JSON with citations and calc steps       AI call 2
  → verify quotes and numbers, run the calculation               code
  → one repair round only if a check failed                      AI call 3 (rare)
  → translate the verified answer (Urdu / Roman Urdu only)       AI call (+1)
  → answer
```

**English questions normally cost 2 AI calls; Urdu and Roman Urdu cost 3.** Cached questions and invalid input cost 0.

### Safety checks (all in code, before the customer sees anything)

| Check | What it stops |
| --- | --- |
| **Quote check** (`lib/verify.js`) | Each citation's quote must be copied word for word from that policy item. A made-up or reworded quote is dropped, and that part becomes "not covered". |
| **Number check** (`lib/verify.js`) | Every number in an answer must appear in the items it cites, the customer's message or the code-computed date facts. Calculated amounts must be `{{placeholders}}` that code fills in. |
| **Worked examples** | The policy files mark examples "(illustration only)". Their made-up prices can never confirm an amount in a real answer. |
| **Unused calculation step** | A step that nothing uses (e.g. a return fee worked out but never subtracted) means a rule was left out, so a repair is triggered. |
| **Last safety net** | A sentence with a number that is still unconfirmed after the repair is removed, never shown. |
| **Date evidence** (`lib/extract.js`) | Every date the AI reads must come with the exact words it read it from, and those words must be in the customer's message. Relative dates ("yesterday", "last Tuesday") are counted by code, never by the AI. |
| **Prompt injection** (`scripts/build-index.mjs`) | Lines in the policy files written as instructions to an AI are dropped when the files are indexed. |
| **Translation check** (`lib/translate.js`) | A translated sentence is used only if it has exactly the same numbers as the English one. Otherwise that sentence stays in English. |

### Languages

- **Urdu script** is detected in code (`lib/lang.js`), which is exact. **Roman Urdu** is reported by the fact extractor, which already reads every question, so it costs nothing extra. A small word list is used only if the AI is down.
- Reasoning, citations, quote and number checks all stay in **English**. Only the final, verified answer is translated, so translation can never change a rule or an amount.
- Urdu digits (۰-۹), Urdu month names and Urdu place names (لاہور, سکردو, دبئی…) are understood.
- The UI shows Urdu right to left in the Noto Nastaliq Urdu font, while amounts, dates, codes and citations stay left to right.

### Models

| Job | Model | Fallback |
| --- | --- | --- |
| Fact extraction | Groq `openai/gpt-oss-20b` | Gemini `gemini-2.5-flash-lite`, then regex |
| Answer | Groq `openai/gpt-oss-120b` | Groq `openai/gpt-oss-20b`, then Gemini `gemini-2.5-flash-lite` |
| Translation to Urdu / Roman Urdu | Gemini `gemini-2.5-flash-lite` | Groq `openai/gpt-oss-120b` |
| Meaning search | Gemini `gemini-embedding-001` (256 dimensions) | keyword search only |
| Voice input / read aloud | Browser Web Speech API | mic hidden if unsupported |

`lib/llm.js` retries rate limits and server errors with backoff, follows `Retry-After`, and pauses a rate-limited model for 60 seconds (circuit breaker) so customers don't wait on retries that won't work. If every model fails, the bot shows the policy rules most related to the question instead of an error.

---

## Run it locally

Needs **Node.js 22** or newer.

```bash
npm install
cp .env.example .env.local     # then put your keys in .env.local
npm run dev
```

Open http://localhost:3000.

The first `npm run dev` embeds all 270 policy items (about 3 minutes on Gemini's free tier). After that the saved vectors in `lib/policy-embeddings.js` are reused until a policy file changes.

### Environment variables

| Variable | Required | Default |
| --- | --- | --- |
| `GROQ_API_KEY` | yes | |
| `GEMINI_API_KEY` | yes (fallback, translation, meaning search) | |
| `GROQ_FAST_MODEL` | no | `openai/gpt-oss-20b` |
| `GROQ_MAIN_MODEL` | no | `openai/gpt-oss-120b` |
| `GEMINI_MODEL` | no | `gemini-2.5-flash-lite` |
| `GEMINI_EMBED_MODEL` | no | `gemini-embedding-001` |

Keys go in `.env.local`, which is in `.gitignore` and never committed.

### Tests

```bash
npm test
```

40 offline tests (no API keys needed): date rules, the calculator, policy versions and regions, search, fact extraction, the quote and number checks, and Urdu support.

```bash
npm run build
```

---

## API

### `POST /api/ask`

```json
{ "question": "Today is 2026-07-01. Can I return opened headphones delivered 2026-06-27 in Lahore?",
  "history": [{ "role": "user", "text": "..." }, { "role": "bot", "text": "..." }] }
```

`history` is optional (earlier turns, so the bot can use the answer to its clarifying question).

Every response has `status` and a plain-text `answer` with the sources inline:

| `status` | Meaning |
| --- | --- |
| `answer` | Answered. Also has `parts` (with `citations`), `calculation`, `rules`, `version_note` |
| `clarify` | One question back to the customer, in `question` |
| `not_covered` | The policy files don't cover it |
| `fallback` | The AI was unavailable; `sources` has the most related policy rules |
| `error` | Invalid input (HTTP 400) |

Other fields: `language` (`en` / `ur` / `roman_ur`), `answer_en` (the English original), `translation_note`, and `meta` (`ai_calls`, `tokens`, `providers`, `ms`, `cached`, `semantic_search`).

### `GET /api/health`

Number of policy files and items, whether meaning search is on, and which providers are configured or paused.

---

## Deploy on Vercel

1. Import the GitHub repository in Vercel.
2. Add `GROQ_API_KEY` and `GEMINI_API_KEY` under **Settings → Environment Variables**.
3. Deploy. The build indexes the policy files and reuses the committed vectors.

---

## Project layout

```
app/
  page.js              chat UI: RTL Urdu, mic, read aloud
  layout.js            Urdu font
  api/ask/route.js     POST /api/ask
  api/health/route.js  GET /api/health
lib/
  pipeline.js          the full answer pipeline
  extract.js           AI call 1: facts from the message, with date evidence
  resolver.js          which policy files are in force (dates, versions, regions)
  dates.js             day, business-day and full-month counting (file 00 §1.5–1.7)
  retrieve.js          hybrid search, topic sections and cross-references
  embeddings.js        meaning search
  prompt.js            AI call 2: answer prompt
  verify.js            quote and number checks
  calc.js              exact whole-rupee calculator
  llm.js               Groq / Gemini router, retries, circuit breaker
  lang.js              language detection, Urdu digits, months and places
  translate.js         translation with the number check
  validate.js          input checks
  cache.js             in-memory answer cache
scripts/
  build-index.mjs      policy files -> citable items (runs before dev / build / test)
  build-embeddings.mjs policy items -> meaning vectors
tests/
  offline.test.mjs
policies/              the knowledge base (not edited)
```

---

## Known limits

- **Free-tier rate limits.** Groq's free tier allows about one `gpt-oss-120b` answer per minute. When questions come fast, the smaller fallback models answer. The checks keep wrong numbers out, but those answers can be less complete.
- **The cache is in memory**, so it is lost when the server restarts. A real shop would use a shared store such as Redis.
- **Voice input** works in Chrome and Edge only. Chrome sends the audio to Google's speech service to turn it into text.
- **Read aloud in Urdu** needs an Urdu (or Hindi) voice installed on the device. Without one, the default voice is used.

---

## Knowledge base

The `policies/` folder holds the 22 NovaCart policy files and is the only knowledge the bot uses. The files are not edited. **File 00** explains the conventions the others rely on: currency and tax, rounding, how days and months are counted, regions and categories, calculation order, which version is in force, and what to do when files disagree.

| Topic | Files |
| --- | --- |
| How the policies fit together | 00 |
| Returns and refunds | 01, 02, 03, 04 |
| Shipping | 05, 06, 07, 21 |
| Warranty | 08, 09 |
| Payments | 10, 11 |
| Offers and promo codes | 12, 13, 14 |
| Privacy | 15, 16 |
| Rules for sellers | 17, 18 |
| Special rules for some regions | 19, 20 |

Each file starts with front matter (`doc_id`, `title`, `version`, `effective_date`, `scope`) and has numbered items (`**3.2** ...`). Items are the unit the bot cites, e.g. `06_shipping_fees_and_free_shipping.md`, Section 2.2. Prices are in PKR, whole rupees, including 18% GST. Dates are `YYYY-MM-DD`, and the bot never uses the system clock: only dates stated by the customer count.

---

*Tech Fusion '26 · Innovate · Integrate · Inspire*
