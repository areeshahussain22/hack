// Language helpers for English / Urdu (script) / Roman Urdu. Pure functions, no AI.
//
// How the language is decided:
//  - Urdu script (اردو) is detected here, exactly: Arabic-script letters are a fixed Unicode range.
//  - Roman Urdu (Urdu in Latin letters) is reported by the fact extractor AI, which already reads every
//    question, so it costs nothing extra and understands spelling variations ("mujhy", "chaiye").
//  - ROMAN_UR_BACKUP below is used ONLY when the extractor AI is unavailable.

const URDU_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
export const hasUrduScript = text => URDU_SCRIPT.test(String(text || ''));

/** Urdu/Persian (۰-۹) and Arabic-Indic (٠-٩) digits, ٬ and ٫ -> ASCII, so dates and Rs amounts parse. */
export function normalizeDigits(text) {
  return String(text ?? '')
    .replace(/[۰-۹]/g, d => String(d.charCodeAt(0) - 0x06F0))
    .replace(/[٠-٩]/g, d => String(d.charCodeAt(0) - 0x0660))
    .replace(/٬/g, ',')
    .replace(/٫/g, '.');
}

// Backup only (AI down): common Roman Urdu words, whole words, at least 2 must appear.
const ROMAN_UR_BACKUP = ['mera', 'meri', 'mujhe', 'kya', 'hai', 'hain', 'nahi', 'kab', 'kaise', 'kitna', 'kitne', 'wapas',
  'paise', 'paisay', 'karun', 'chahiye', 'aur', 'abhi', 'tak', 'hoga', 'kar', 'sakta', 'sakti', 'kyun'];

/** Code-only detection: exact for Urdu script; word-list backup for Roman Urdu. */
export function detectLanguage(text) {
  const t = String(text || '');
  if (hasUrduScript(t)) return 'ur';
  const words = t.toLowerCase().match(/[a-z]+/g) || [];
  const hits = words.filter(w => ROMAN_UR_BACKUP.includes(w)).length;
  return hits >= 2 ? 'roman_ur' : 'en';
}

/**
 * Final language: Urdu script always wins (exact). Otherwise trust the extractor AI's answer
 * ('en' or 'roman_ur'); if the AI was unavailable, use the word-list backup.
 */
export function chooseLanguage(text, aiLanguage) {
  if (hasUrduScript(text)) return 'ur';
  if (aiLanguage === 'en' || aiLanguage === 'roman_ur') return aiLanguage;
  return detectLanguage(text);
}

// Urdu place names -> the English names the region code already uses.
// Longer names first, so "گلگت بلتستان" is matched before "گلگت".
export const URDU_PLACES = {
  'گلگت بلتستان': 'gilgit-baltistan', 'آزاد کشمیر': 'azad kashmir', 'اسلام آباد': 'islamabad', 'فیصل آباد': 'faisalabad',
  'لاہور': 'lahore', 'کراچی': 'karachi', 'راولپنڈی': 'rawalpindi', 'ملتان': 'multan', 'پشاور': 'peshawar', 'کوئٹہ': 'quetta',
  'گلگت': 'gilgit', 'سکردو': 'skardu', 'ہنزہ': 'hunza', 'مظفرآباد': 'muzaffarabad', 'مظفر آباد': 'muzaffarabad', 'میرپور': 'mirpur',
  'کشمیر': 'kashmir', 'دبئی': 'dubai', 'امارات': 'uae', 'لندن': 'london', 'برطانیہ': 'uk', 'امریکہ': 'usa', 'امریکا': 'usa',
};

/** Appends the English names of any Urdu places found, so the existing English matching keeps working. */
export function placesToEnglish(text) {
  const t = String(text || '');
  const found = [];
  let rest = t;
  for (const [ur, en] of Object.entries(URDU_PLACES).sort((a, b) => b[0].length - a[0].length)) {
    if (rest.includes(ur)) { found.push(en); rest = rest.split(ur).join(' '); }
  }
  return found.length ? `${t} ${[...new Set(found)].join(' ')}` : t;
}

/** Urdu month names -> month number 1-12. */
export const URDU_MONTHS = {
  'جنوری': 1, 'فروری': 2, 'مارچ': 3, 'اپریل': 4, 'مئی': 5, 'جون': 6,
  'جولائی': 7, 'اگست': 8, 'ستمبر': 9, 'اکتوبر': 10, 'نومبر': 11, 'دسمبر': 12,
};

// Fixed (no AI) customer-facing texts.
export const NOT_COVERED_TEXT = {
  en: 'This is not covered in the NovaCart policy files, so I cannot answer it. Please contact NovaCart support.',
  ur: 'یہ بات NovaCart کی پالیسی فائلوں میں شامل نہیں، اس لیے میں اس کا جواب نہیں دے سکتا۔ براہِ کرم NovaCart سپورٹ سے رابطہ کریں۔',
  roman_ur: 'Yeh baat NovaCart ki policy files mein shamil nahi, is liye main iska jawab nahi de sakta. Meharbani karke NovaCart support se rabta karein.',
};
export const TRANSLATION_NOTE = {
  ur: 'یہ جواب انگریزی میں ہے کیونکہ ترجمہ دستیاب نہیں تھا۔',
  roman_ur: 'Yeh jawab English mein hai kyunke tarjuma dastiyab nahi tha.',
};
export const PARTIAL_TRANSLATION_NOTE = {
  ur: 'اس جواب کا کچھ حصہ انگریزی میں ہے تاکہ رقم اور تاریخیں بالکل درست رہیں۔',
  roman_ur: 'Is jawab ka kuch hissa English mein hai taa ke raqam aur tareekhein bilkul durust rahein.',
};

// Labels used in the plain-text `answer`.
export const TEXT_LABELS = {
  en: { source: 'Source', calculation: 'Calculation', rules: 'Rules applied in order', because: 'because', dates: 'Dates I worked out', note: 'Note' },
  ur: { source: 'حوالہ', calculation: 'حساب', rules: 'لاگو قواعد (ترتیب سے)', because: 'کیونکہ', dates: 'تاریخیں جو حساب کی گئیں', note: 'نوٹ' },
  roman_ur: { source: 'Hawala', calculation: 'Hisaab', rules: 'Lagu qawaid (tarteeb se)', because: 'kyunke', dates: 'Tareekhein jo hisaab ki gayin', note: 'Note' },
};
