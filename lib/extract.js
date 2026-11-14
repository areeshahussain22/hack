// AI call 1 (small fast model): turn a messy customer message into clean facts.
// Falls back to regex if the AI is unavailable, so the pipeline never stops here.
import { callLLM } from './llm.js';
import { isValidDate, addDays, parseDate, daysBetween, weekday as weekdayOf } from './dates.js';
import { TOPICS } from './retrieve.js';

const TOPIC_KEYS = Object.keys(TOPICS);

const SYSTEM = `You extract facts from a customer message for an online store. Return ONLY JSON.
Use only what the customer actually said (including the conversation history). Never invent values: use null or [] when missing.
Write dates as YYYY-MM-DD. "contact_date" is the date the customer says it is today / the date they are asking or requesting.
For every date, copy into "evidence" the exact words from the customer's text that state it (e.g. "got it on 25th June").
If the customer gave the order or delivery date only relative to today (e.g. "yesterday", "3 days ago", "last Tuesday"),
set that date to null and describe it in "relative_dates" instead. Do NOT calculate the date yourself; code does that.
Use days_ago for counts of days ("yesterday" = 1, "3 days ago" = 3, "two weeks ago" = 14) and weekday for a named day.
Vague phrases ("last week", "a while ago", "recently", "last month") are not dates: leave them out.
"order_date" is when the customer ordered or paid. "delivery_date" is when the item reached them (came, arrived, got it, received).
JSON shape:
{
 "contact_date": string|null, "order_date": string|null, "delivery_date": string|null,
 "evidence": {"contact_date": string|null, "order_date": string|null, "delivery_date": string|null},
 "relative_dates": {
   "order_date": {"evidence": string, "days_ago": number|null, "weekday": "monday"|"tuesday"|"wednesday"|"thursday"|"friday"|"saturday"|"sunday"|null}|null,
   "delivery_date": (same shape)|null
 },
 "other_dates": [{"label": string, "date": string, "evidence": string}],
 "place": string|null,              // city or country of delivery, as written
 "region_class": "metro"|"rest_of_pakistan"|"remote"|"international"|"not_served"|"unknown",
 "seller": "novacart"|"marketplace"|"unknown",
 "items": [{"name": string, "category": "electronics"|"clothing"|"grocery/perishables"|"furniture/bulky"|"personal care"|"unknown", "price": number|null, "opened_or_used": boolean|null, "being_returned": boolean|null}],
 "promo_codes": [string], "payment_method": string|null, "shipping_option": "standard"|"express"|null,
 "reason": string|null,             // e.g. change of mind, defective, wrong item, damaged
 "topics": [${TOPIC_KEYS.map(t => `"${t}"`).join(', ')}],
 "search_terms": string,            // 5-15 policy keywords for a search engine
 "sub_questions": [string]          // each separate question the customer asked
}
Metro cities: Islamabad, Lahore, Karachi. Remote areas: Azad Jammu & Kashmir, Gilgit-Baltistan.
International: USA, UK, UAE only (other countries = "not_served"). Other places in Pakistan = "rest_of_pakistan".`;

const TOPIC_WORDS = {
  returns: /return|send back|exchange/i, refund_amount: /refund|money back|how much .*(get|back)|reimburse/i, refund_timing: /when.*refund|how long|refund.*(take|time)/i,
  cancellation: /cancel/i, shipping_fee: /shipping|delivery (fee|charge|cost)|freeship/i, delivery: /deliver|dispatch|track|address/i,
  lost_damaged: /lost|damaged|broken|wrong item|not received/i, warranty: /warranty|repair|defect/i, payment: /pay|card|bank|wallet/i,
  cod: /\bcod\b|cash on delivery/i, promo: /code|coupon|promo|discount|welcome10|style15|tech500/i, sale_bundle: /sale|bundle|final sale/i,
  store_credit: /store credit|credit/i, privacy: /privacy|cookie|data|personal/i, data_request: /delete|copy of (my )?data|retention/i,
  marketplace: /seller|marketplace/i, international: /usa|uk|uae|dubai|london|international|abroad|customs/i, remote: /gilgit|kashmir|ajk|baltistan|remote/i,
  gst_tax: /gst|tax/i, checkout_total: /total|checkout|pay in all/i,
};

/** Regex fallback: dates, Rs amounts and promo codes. */
export function regexExtract(text) {
  const dates = [...text.matchAll(/\b(\d{4}-\d{2}-\d{2})\b/g)].map(m => m[1]).filter(isValidDate);
  const find = re => { const m = text.match(re); return m && isValidDate(m[1]) ? m[1] : null; };
  // Look up to 40 chars ahead (prices like "Rs. 5,000" may sit in between),
  // but stop if another date keyword comes first, so "ordered X, delivered on <date>" is not read as the order date.
  const order = find(/(?:order(?:ed)?|placed|bought|purchased)\b(?:(?!deliver|arriv|receiv|today)[^\n]){0,40}?(\d{4}-\d{2}-\d{2})/i);
  const delivery = find(/(?:deliver(?:ed|y)|arrived|received)\b(?:(?!order|placed|bought|purchas|today)[^\n]){0,40}?(\d{4}-\d{2}-\d{2})/i);
  // Contact date: stated explicitly, else the latest other date (contact is never before order/delivery)
  const others = dates.filter(d => d !== order && d !== delivery).sort();
  return {
    contact_date: find(/(?:today is|today|it is now|asking on|contact(?:ing)?(?: date)?(?: is| on)?|request(?:ed)? on)\s*(\d{4}-\d{2}-\d{2})/i) || others[others.length - 1] || null,
    order_date: order,
    delivery_date: delivery,
    other_dates: [],
    place: null, region_class: 'unknown', seller: 'unknown', items: [],
    promo_codes: [...new Set((text.match(/\b(WELCOME10|STYLE15|TECH500|FREESHIP|[A-Z]{4,}\d{1,3})\b/g) || []))],
    payment_method: /\bcod\b|cash on delivery/i.test(text) ? 'cash on delivery' : null,
    shipping_option: /express/i.test(text) ? 'express' : null,
    reason: null, topics: Object.keys(TOPIC_WORDS).filter(t => TOPIC_WORDS[t].test(text)), search_terms: '', sub_questions: [text],
  };
}

// Grounding check: a value the AI "found" must actually be in the customer's text.
// Stops made-up dates, codes or prices from reaching the answer step.
const norm = s => String(s || '').toLowerCase().replace(/\s+/g, ' ').trim();
const monthName = m => new Intl.DateTimeFormat('en', { month: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2000, m - 1, 1))).toLowerCase();

function grounded(text) {
  const t = norm(text);
  const digits = text.replace(/[,\s]/g, '');
  return {
    // The AI must show its evidence: the exact words it read the date from.
    // 1. The evidence must be copied from the customer's text (so it can't be made up).
    // 2. The evidence must agree with the date: same day number, same month (number or name),
    //    and no different year. Any wording works; there is no list of date formats.
    date: (d, evidence) => {
      if (t.includes(d)) return true; // the YYYY-MM-DD date itself is in the text
      const q = norm(evidence);
      if (!q || !t.includes(q)) return false;
      const [y, m, day] = d.split('-').map(Number);
      const nums = (q.match(/\d+/g) || []).map(Number);
      const count = n => nums.filter(x => x === n).length;
      const hasDay = count(day) > 0;
      const hasMonth = q.includes(monthName(m).slice(0, 3)) || (m === day ? count(m) > 1 : count(m) > 0);
      const otherYear = nums.some(n => n > 31 && n !== y);
      return hasDay && hasMonth && !otherYear;
    },
    code: c => t.includes(c.toLowerCase()),
    price: p => p == null || digits.includes(String(Math.round(Number(p)))),
  };
}

// Weekday names from the built-in date formatter (2023-01-01 was a Sunday), not a hand-typed list.
const WEEKDAY_NAMES = Array.from({ length: 7 }, (_, i) =>
  new Intl.DateTimeFormat('en', { weekday: 'long', timeZone: 'UTC' }).format(new Date(Date.UTC(2023, 0, 1 + i))).toLowerCase());

/**
 * Relative dates ("yesterday", "3 days ago", "last Tuesday"): the AI only describes them,
 * code does the counting from the contact date. Returns { date, note } or null.
 * Checks: the evidence words are in the customer's text, a named weekday really appears in them,
 * and if the evidence has a number, it is the number of days (or weeks x 7) the AI used.
 */
export function resolveRelative(rel, contactDate, text) {
  if (!rel || typeof rel !== 'object' || !isValidDate(contactDate)) return null;
  const q = norm(rel.evidence);
  if (!q || !norm(text).includes(q)) return null;
  let date = null;
  // A weekday named in the customer's own words always wins over the AI's day count
  const named = WEEKDAY_NAMES.filter(n => q.includes(n));
  if (named.length > 1) return null;
  const wd = named.length ? WEEKDAY_NAMES.indexOf(named[0]) : WEEKDAY_NAMES.indexOf(String(rel.weekday || '').toLowerCase());
  if (wd >= 0) {
    if (!q.includes(WEEKDAY_NAMES[wd])) return null;
    // Most recent such weekday before the contact date (1 to 7 days back)
    const back = ((parseDate(contactDate).getUTCDay() - wd + 7) % 7) || 7;
    date = addDays(contactDate, -back);
  } else if (Number.isInteger(rel.days_ago) && rel.days_ago >= 0 && rel.days_ago <= 366) {
    const nums = (q.match(/\d+/g) || []).map(Number);
    if (nums.length && !nums.some(n => n === rel.days_ago || n * 7 === rel.days_ago)) return null;
    date = addDays(contactDate, -rel.days_ago);
  }
  if (!date) return null;
  return { date, note: `"${rel.evidence}" read as ${date} (${weekdayOf(date)}), counted back from the contact date ${contactDate}` };
}

export function sanitize(f, fallback, text = '') {
  const g = grounded(text);
  const out = { ...fallback, ...(f && typeof f === 'object' ? f : {}) };
  const evidence = out.evidence && typeof out.evidence === 'object' ? out.evidence : {};
  const guessed = new Set();
  const aiCounted = {}; // dates the AI worked out itself from words like "yesterday": recounted by code below
  for (const k of ['order_date', 'delivery_date', 'contact_date']) {
    if (!isValidDate(out[k]) || !g.date(out[k], evidence[k])) {
      if (isValidDate(out[k]) && evidence[k]) aiCounted[k] = { date: out[k], evidence: evidence[k] };
      out[k] = isValidDate(fallback[k]) ? fallback[k] : null; guessed.add(k);
    }
  }
  delete out.evidence;
  // A guessed contact date must not just repeat the order or delivery date
  if (guessed.has('contact_date') && [out.order_date, out.delivery_date].includes(out.contact_date)) out.contact_date = null;
  // Relative dates fill only what is still missing, and only when the contact date is known
  const rels = out.relative_dates && typeof out.relative_dates === 'object' ? { ...out.relative_dates } : {};
  // If the AI counted a relative date itself, treat it as relative and let code check and recount it
  for (const [k, c] of Object.entries(aiCounted)) {
    if (!rels[k] && k !== 'contact_date' && isValidDate(out.contact_date)) rels[k] = { evidence: c.evidence, days_ago: daysBetween(c.date, out.contact_date) };
  }
  // One phrase can't be both the order and the delivery date ("it came 3 days ago"): keep it for delivery only
  if (rels.order_date?.evidence && norm(rels.order_date.evidence) === norm(rels.delivery_date?.evidence)) rels.order_date = null;
  out.date_notes = [];
  for (const k of ['order_date', 'delivery_date']) {
    if (out[k]) continue;
    const r = resolveRelative(rels[k], out.contact_date, text);
    if (r) { out[k] = r.date; out.date_notes.push(`${k.replace('_', ' ')}: ${r.note}`); }
    else if (rels[k]?.evidence && !out.contact_date) out.date_notes.push(`${k.replace('_', ' ')}: "${rels[k].evidence}" needs the contact date to work out`);
  }
  delete out.relative_dates;
  out.other_dates = Array.isArray(out.other_dates)
    ? out.other_dates.filter(d => d && isValidDate(d.date) && g.date(d.date, d.evidence)).map(({ label, date }) => ({ label, date })).slice(0, 5)
    : [];
  out.items = Array.isArray(out.items)
    ? out.items.slice(0, 10).map(it => ({ ...it, price: g.price(it?.price) ? it?.price ?? null : null }))
    : [];
  out.promo_codes = Array.isArray(out.promo_codes) ? out.promo_codes.map(c => String(c).toUpperCase()).filter(g.code).slice(0, 3) : [];
  // Topics: union of the AI's topics and the keyword topics, so one missing never loses a section
  out.topics = [...new Set([...(Array.isArray(out.topics) ? out.topics : []), ...fallback.topics])].filter(t => TOPIC_KEYS.includes(t));
  out.sub_questions = Array.isArray(out.sub_questions) ? out.sub_questions.map(String).slice(0, 6) : [];
  out.search_terms = typeof out.search_terms === 'string' ? out.search_terms.slice(0, 300) : '';
  return out;
}

export async function extractFacts(question, history) {
  const convo = history.map(h => `${h.role === 'user' ? 'Customer' : 'Assistant'}: ${h.text}`).join('\n');
  const allText = `${convo}\n${question}`;
  const fallback = regexExtract(allText);
  try {
    const { data, provider, model, tokens } = await callLLM({
      role: 'fast',
      system: SYSTEM,
      user: `CONVERSATION HISTORY:\n${convo || '(none)'}\n\nLATEST CUSTOMER MESSAGE:\n${question}\n\nReturn the JSON now.`,
      maxTokens: 1500,
    });
    return { facts: sanitize(data, fallback, allText), provider, model, tokens, usedFallback: false };
  } catch (err) {
    console.warn('[extract] AI failed, using regex fallback:', err.message);
    return { facts: sanitize(null, fallback, allText), provider: 'regex', model: null, usedFallback: true };
  }
}
