// Decides which policy files apply, using ONLY front matter dates and scope (00 §3 and §4).
import INDEX from './policy-index.js';
import { isValidDate } from './dates.js';

// Known topic overlaps between files (read from the files themselves).
// older: replaced on the shared topic once `newer` is in force (00 §4.2: later effective_date wins).
const OVERLAPS = [
  { older: '02', newer: '01', topic: 'returns', full: true },
  { older: '06', newer: '21', topic: 'Metro and Rest of Pakistan standard fees, free-shipping thresholds, express fee and bulky surcharge', full: false },
];
const REGIONAL = { remote: '19', international: '20' };

const METRO = ['islamabad', 'lahore', 'karachi'];
const REMOTE = ['azad jammu', 'kashmir', 'ajk', 'gilgit', 'baltistan', 'skardu', 'hunza', 'muzaffarabad'];
const INTL = ['usa', 'united states', 'america', 'u.s.', 'uk', 'united kingdom', 'england', 'britain', 'london', 'uae', 'emirates', 'dubai', 'abu dhabi', 'sharjah'];

/** Code check on the place text. Code wins over the AI when a known name is found. */
export function classifyRegion(place, aiGuess) {
  const p = ` ${String(place || '').toLowerCase()} `;
  const has = list => list.some(w => new RegExp(`(^|[^a-z])${w.replace('.', '\\.')}([^a-z]|$)`).test(p));
  if (has(METRO)) return 'metro';
  if (has(REMOTE)) return 'remote';
  if (has(INTL)) return 'international';
  const allowed = ['metro', 'rest_of_pakistan', 'remote', 'international', 'not_served'];
  return allowed.includes(aiGuess) ? aiGuess : 'unknown';
}

export function resolvePolicies({ contactDate, region }) {
  const files = Object.values(INDEX.files);
  const notices = [];
  const excluded = {}; // fileNo -> reason
  const hasDate = isValidDate(contactDate);

  if (hasDate) {
    for (const f of files) {
      if (f.effective_date > contactDate) excluded[f.fileNo] = `not yet in force on ${contactDate} (effective ${f.effective_date}, 00 §3.1)`;
    }
  } else {
    notices.push('The contact date is unknown. If the answer depends on which policy version is in force (for example returns: file 02 vs file 01; shipping fees: file 06 vs file 21), ask the customer for the date they are contacting us.');
  }

  for (const o of OVERLAPS) {
    const newerIn = hasDate ? !excluded[o.newer] : false;
    const olderIn = !excluded[o.older];
    const nf = INDEX.files[o.newer], of = INDEX.files[o.older];
    if (hasDate && newerIn && olderIn) {
      if (o.full) excluded[o.older] = `replaced by ${nf.file} (later effective date, 00 §4.2)`;
      notices.push(`Files differ on ${o.topic}: ${of.file} (effective ${of.effective_date}) and ${nf.file} (effective ${nf.effective_date}). Use ${nf.file} for this topic and TELL the customer the files differ and which one was used (00 §4.2).`);
    }
  }

  if (region === 'remote' || region === 'international') {
    const keep = REGIONAL[region];
    for (const [r, no] of Object.entries(REGIONAL)) if (r !== region && !excluded[no]) excluded[no] = `regional file for ${r} only`;
    if (excluded[keep]) notices.push(`Region is ${region}, but ${INDEX.files[keep].file} is ${excluded[keep]}, so the general files apply.`);
    else notices.push(`Region is ${region}: ${INDEX.files[keep].file} (scope regional) overrides general and specific files for the topics it covers; topics it does not mention follow the other files (00 §4.1).`);
  } else if (region === 'metro' || region === 'rest_of_pakistan') {
    excluded['19'] = 'regional file for Remote areas only';
    excluded['20'] = 'regional file for International only';
  } else if (region === 'not_served') {
    notices.push('The destination is not a place NovaCart serves. International means only the USA, the UK or the UAE (00 §2.3).');
  } else {
    notices.push('The delivery region is unknown. If the answer depends on region (Metro, Rest of Pakistan, Remote areas, International), ask for the city or country.');
  }

  const allowed = new Set(files.map(f => f.fileNo).filter(n => !excluded[n]));
  return {
    allowed,
    excluded: Object.entries(excluded).map(([fileNo, reason]) => ({ file: INDEX.files[fileNo].file, reason })),
    notices,
  };
}
