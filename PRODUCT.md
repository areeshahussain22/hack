# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

1. **Shoppers in Pakistan.** Mostly on phones, often in a hurry or annoyed because something has gone wrong: a return, a refund, a lost parcel. They write in English, Urdu (اردو) or Roman Urdu, and may want to use voice. Many are not technical. Their job: find out exactly what NovaCart's policy says about their situation, and what they are owed, without reading 22 documents.
2. **Hackathon judges (Tech Fusion '26, Challenge A).** On laptops, watching a screen-recorded demo video. They score correct grounded answers, visible citations, correct maths with steps shown, handling of messy questions, practicality, and extra features.

## Product Purpose

NovaBot is the customer-support chat for NovaCart, a fictional Pakistani online store. It answers questions about store policy using only NovaCart's 22 policy files.

Success means the shopper gets an answer they can trust and check: the rule that applies, the exact file and section it comes from, and any amount worked out step by step. When the policies do not cover a question, NovaBot says so instead of guessing. When a detail it needs is missing, it asks one short question.

## Positioning

A support bot that shows its working. Every claim is tied to a numbered policy section, often with a word-for-word quote. Money is calculated by code, not by the language model, and the steps are shown. Code also decides which policy version and regional file are in force on the customer's dates. "Not covered" is a proper answer, not a failure.

## Operating Context

- **Chat on the web.** Next.js app at `app/`. The page is a single chat; the API is `POST /api/ask` (`{ question, history }`), with `GET /api/health` for the deploy health check.
- **Answer pipeline in `lib/pipeline.js`.** Extract facts, pick the files in force (dates, region), retrieve policy items with keyword and embedding search, generate the answer, verify citations and numbers (with one repair round if a check fails), and calculate in code. Each result has a `status` of `answer`, `clarify`, `not_covered`, `fallback` or `error`, plus a plain-text `answer`. An `answer` result has per-part citations, a calculation table, the rules applied in order, date notes and version notes.
- **Knowledge base.** `policies/` holds 22 Markdown files (00 to 21). They must not be edited. Citations use the form `06_shipping_fees_and_free_shipping.md §2.2`.
- **Deployment.** Render, running Node 22.
- **Submission.** Via a Google Form; the ETL platform is no longer used. Exactly what the form asks for (repo link, deployed URL, video) is not confirmed. Judges see the product mainly through the demo video.

## Capabilities and Constraints

- Answers come only from `policies/`. No outside knowledge of real stores, laws or products.
- Currency is PKR ("Rs."), whole rupees, rounded half up. Dates are `YYYY-MM-DD`. Questions state their own dates; the system clock is never used.
- Policy text containing instructions aimed at AI assistants is stripped at index time and never followed.
- **Urdu and Roman Urdu:** a teammate is writing the language handling. The UI must already support it: right-to-left Urdu set in a Nastaliq font next to left-to-right English, mixed within one reply. Citations, Rs. amounts and dates always stay LTR.
- **Voice:** shoppers may want to speak their question and hear the reply; mic and speaker controls are expected. The underlying speech features are not built yet and their owner is not confirmed.
- Must work at 360px phone width and look good in a 1920×1080 screen recording.
- AI providers are Groq (`openai/gpt-oss-20b`, `openai/gpt-oss-120b`) with Gemini as fallback. If both fail, the user gets a `fallback` result listing the most relevant policy rules.

## Brand Commitments

- **Name:** NovaBot, for NovaCart.
- **Feeling:** calm, trustworthy, clear, warm rather than cold. The user should think "this is exact and I can check it". Like a good bank receipt or a well-made government service page, not a toy chatbot. Clean, minimal, very easy to use.
- **Voice:** plain, short sentences. Friendly but not cute. No exclamation marks. No emoji in UI copy; 🎤 and 🔊 are acceptable as icons.
- **Anti-references (binding):** the generic AI-startup look (purple/blue gradients, glassmorphism, glowing borders, sparkles, neon on black); dense admin dashboards; cartoon chatbot avatars; everything in rounded cards with shadows; a centred hero with a giant gradient headline.

## Evidence on Hand

- The 22 policy files in `policies/`. They are the only content source and include worked examples marked as illustrations.
- Offline tests in `tests/offline.test.mjs`, covering dates, maths, version resolution, region detection and retrieval.
- No real customers, testimonials, usage numbers or benchmark results exist. Do not invent them.

## Product Principles

1. **Checkable over clever.** Every answer shows where it came from and how any number was reached. If it can't be checked, it isn't shown.
2. **Honest limits.** "Not covered" and one clarifying question beat a confident guess.
3. **Built for a stressed shopper on a phone.** Short, plain, quick to scan, in their language.
4. **Code decides facts, the model writes words.** Dates, policy versions, regions and money are settled in code.
5. **Easy to judge.** The grounding, citations and steps must be obvious to someone watching a recording.

## Accessibility & Inclusion

- WCAG 2.1 AA contrast.
- Full keyboard use.
- Respect `prefers-reduced-motion`.
- Bidirectional text: Urdu RTL (Nastaliq) and English LTR in one reply, with numbers, amounts, dates and citations isolated as LTR.
- Many users are not technical; voice input and read-aloud matter for them.
