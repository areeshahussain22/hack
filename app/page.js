'use client';
import { Fragment, useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

/* ---------- Content ---------- */

const EXAMPLES = [
  { tag: 'Refund with maths', icon: 'receipt', text: 'Today is 2026-07-01. My headphones were delivered in Lahore on 2026-06-28. I opened them and they work fine. I paid Rs. 12,000. How much refund will I get?' },
  { tag: 'Missing a detail', icon: 'question', text: 'Can I still return a jacket I bought last month?' },
  { tag: 'Regional rule', icon: 'pin', text: 'Today is 2026-08-10. What is the shipping fee on a Rs. 3,000 order to Skardu, and can I pay cash on delivery?' },
  { tag: 'اردو', icon: 'language', text: 'آج 2026-07-10 ہے۔ میں نے لاہور میں 2026-07-01 کو STYLE15 کے ساتھ شرٹ (2,400 روپے) اور پتلون (3,600 روپے) خریدی، 2026-07-05 کو ڈیلیور ہوئی۔ صرف شرٹ واپس کرنی ہے، پسند نہیں آئی۔ کتنے پیسے واپس ملیں گے؟' },
];

const LABELS = {
  en: {
    answer: 'Answer', sources: n => `${n} source${n === 1 ? '' : 's'}`, yourTurn: 'Your turn', oneQ: 'one question',
    notCovered: 'Not covered by the policies', limited: 'Limited mode', related: 'related rules below',
    error: 'Could not answer', tryAgain: 'try again', checkQ: 'check your question', thinking: 'Checking the policies…',
    working: 'Working', how: 'How this was worked out', because: 'Because', dates: 'Dates',
    replyHint: 'Reply below. A short answer is enough.', editHint: 'Edit your question in the box below and send it again.',
    listen: 'Listen', stop: 'Stop', retry: 'Try again', fromCache: 'from cache', aiCalls: n => `${n} AI call${n === 1 ? '' : 's'}`,
  },
  ur: {
    answer: 'جواب', sources: n => `${n} حوالے`, yourTurn: 'آپ کی باری', oneQ: 'ایک سوال',
    notCovered: 'پالیسی میں شامل نہیں', limited: 'محدود موڈ', related: 'متعلقہ قواعد نیچے',
    error: 'جواب نہیں دیا جا سکا', tryAgain: 'دوبارہ کوشش کریں', checkQ: 'اپنا سوال دیکھیں', thinking: 'پالیسی دیکھی جا رہی ہے…',
    working: 'حساب', how: 'یہ جواب کیسے بنا', because: 'کیونکہ', dates: 'تاریخیں',
    replyHint: 'نیچے جواب دیں۔ مختصر جواب کافی ہے۔', editHint: 'نیچے والے خانے میں اپنا سوال درست کر کے دوبارہ بھیجیں۔',
    listen: 'سنیں', stop: 'روکیں', retry: 'دوبارہ کوشش کریں', fromCache: 'محفوظ جواب', aiCalls: n => `${n} AI calls`,
  },
};
const labelsFor = lang => (lang === 'ur' ? LABELS.ur : LABELS.en);
const NOT_COVERED_PART = LABELS.en.notCovered;

/* ---------- Icons: one 24px grid, 2px stroke ---------- */

const PATHS = {
  check: <path d="M5 12.5l4.5 4.5L19 7.5" />,
  question: <><path d="M9.2 9.2a2.9 2.9 0 1 1 4.1 2.6c-.8.4-1.3 1.1-1.3 2v.7" /><circle cx="12" cy="18" r=".6" fill="currentColor" /></>,
  dash: <path d="M6 12h12" />,
  limited: <><path d="M4.5 9.5c2.5-2 5-2 7.5 0s5 2 7.5 0" /><path d="M4.5 15c2.5-2 5-2 7.5 0s5 2 7.5 0" /></>,
  cross: <path d="M7 7l10 10M17 7L7 17" />,
  down: <path d="M12 5v14M6 13l6 6 6-6" />,
  send: <path d="M5 12h13M13 6l6 6-6 6" />,
  mic: <><rect x="9" y="3.5" width="6" height="11" rx="3" /><path d="M5.5 11.5a6.5 6.5 0 0 0 13 0M12 18v2.5" /></>,
  speaker: <><path d="M4.5 9.5h3l4.5-4v13l-4.5-4h-3z" /><path d="M15.5 9a4 4 0 0 1 0 6M18 6.5a7.5 7.5 0 0 1 0 11" /></>,
  stop: <rect x="7" y="7" width="10" height="10" rx="1" />,
  close: <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />,
  chevron: <path d="M9 6l6 6-6 6" />,
  note: <><circle cx="12" cy="12" r="8" /><path d="M12 11v5" /><circle cx="12" cy="8" r=".6" fill="currentColor" /></>,
  retry: <><path d="M5 12a7 7 0 1 0 2.1-5" /><path d="M5 4.5V9h4.5" /></>,
  receipt: <><path d="M6 3.5h12v17l-2-1.3-2 1.3-2-1.3-2 1.3-2-1.3-2 1.3z" /><path d="M9 8h6M9 11.5h6M9 15h3.5" /></>,
  pin: <><path d="M12 20.5s6-5.6 6-10.5a6 6 0 0 0-12 0c0 4.9 6 10.5 6 10.5z" /><circle cx="12" cy="10" r="2.2" /></>,
  language: <><path d="M4 6h9M8.5 4v2M6 6c.6 3 2.6 5.4 5 6.5M11 6c-.7 3.4-3 6-6 7.5" /><path d="M12.5 20l3.5-8.5 3.5 8.5M13.8 17h4.4" /></>,
};

function Icon({ name, size = 20 }) {
  return (
    <svg className="icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

/* ---------- Bidirectional text ---------- */

const ARABIC_SCRIPT = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
// Things that must stay left-to-right inside Urdu: file citations, § refs, Rs. amounts, ISO dates, percentages.
const LTR_RUN = /(\d{2}_[a-z0-9_]+\.md(?:,?\s*(?:§|Section)\s*[\d.]+)?|§\s?[\d.]+|Rs\.?\s?[\d,]+(?:\.\d+)?|\d{4}-\d{2}-\d{2}|\b[A-Z]{3,}\d+\b|\d+(?:\.\d+)?\s?%)/g;

const isUrdu = s => ARABIC_SCRIPT.test(String(s || ''));

function BidiText({ text }) {
  const parts = String(text ?? '').split(LTR_RUN);
  // Amounts, dates and percentages never break across lines; long file citations may.
  return parts.map((p, i) => (i % 2 === 1
    ? <bdi key={i} dir="ltr" className={/\.md/.test(p) ? undefined : 'nb'}>{p}</bdi>
    : <Fragment key={i}>{p}</Fragment>));
}

/** A paragraph that picks its own direction and switches to Nastaliq when it is Urdu. */
function Para({ text, className = '', as: Tag = 'p' }) {
  const ur = isUrdu(text);
  return (
    <Tag dir="auto" lang={ur ? 'ur' : undefined} className={`${className}${ur ? ' ur' : ''}`}>
      <BidiText text={text} />
    </Tag>
  );
}

/* ---------- Helpers ---------- */

const rs = n => `Rs. ${Number(n).toLocaleString('en-US')}`;

// "01_returns_policy.md §3.1" -> { no: "01", sec: "3.1", title: "Returns policy" }
function chipParts(source) {
  const m = String(source).match(/^(\d{2})_([a-z0-9_]+)\.md\s*§\s*([\d.]+)/i);
  if (!m) return { no: '', sec: '', title: String(source) };
  const title = m[2].replace(/_/g, ' ').replace(/\b(\d{4})\b/, '$1').replace(/^\w/, c => c.toUpperCase());
  return { no: m[1], sec: m[3], title };
}

function bandFor(r) {
  const L = labelsFor(r.language);
  switch (r.status) {
    case 'answer': {
      const n = new Set(r.parts.flatMap(p => (p.citations || []).map(c => c.source))).size;
      const total = r.calculation?.length ? r.calculation[r.calculation.length - 1].result : null;
      return {
        tone: 'answer', icon: 'check', label: L.answer,
        detail: [n ? L.sources(n) : null, total != null && !r.calcError ? rs(total) : null].filter(Boolean),
      };
    }
    case 'clarify': return { tone: 'clarify', icon: 'question', label: L.yourTurn, detail: [L.oneQ], arrow: true };
    case 'not_covered': return { tone: 'muted', icon: 'dash', label: L.notCovered, detail: [] };
    case 'fallback': return { tone: 'limited', icon: 'limited', label: L.limited, detail: [L.related] };
    case 'loading': return { tone: 'loading', icon: 'limited', label: L.thinking, detail: [] };
    default: return { tone: 'error', icon: 'cross', label: L.error, detail: [r.retryable ? L.tryAgain : L.checkQ] };
  }
}

/* ---------- Pieces of a reply ---------- */

function Band({ r }) {
  const b = bandFor(r);
  return (
    <div className={`band band-${b.tone}`} dir={r.language === 'ur' ? 'rtl' : undefined} lang={r.language === 'ur' ? 'ur' : undefined}>
      <span className="band-pict"><Icon name={b.icon} size={22} /></span>
      <span className="band-text">
        {b.label}
        {b.detail.map(d => <span key={d} className="band-detail"> · <bdi dir={isUrdu(d) ? 'rtl' : 'ltr'}>{d}</bdi></span>)}
      </span>
      {b.arrow && <span className="band-arrow"><Icon name="down" size={20} /></span>}
      {r.status === 'loading' && <span className="band-progress" aria-hidden="true" />}
    </div>
  );
}

function Chips({ citations, onOpen, activeKey, partIndex }) {
  const seen = new Set();
  const unique = citations.filter(c => !seen.has(c.source) && seen.add(c.source));
  if (!unique.length) return null;
  return (
    <ul className="chips" aria-label="Sources">
      {unique.map(c => {
        const k = `${partIndex}:${c.source}`;
        const { no, sec, title } = chipParts(c.source);
        return (
          <li key={k}>
            <button type="button" className="chip" aria-pressed={activeKey === k} aria-haspopup="dialog"
              onClick={e => onOpen({ key: k, source: c.source, quote: c.quote, title, returnTo: e.currentTarget })}>
              {no && <bdi dir="ltr" className="chip-ref">{no} §{sec}</bdi>}
              <span className="chip-title">{title}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Note({ text, warn }) {
  if (!text) return null;
  return (
    <div className={`note${warn ? ' note-warn' : ''}`}>
      <Icon name="note" size={16} />
      <Para as="span" text={text} />
    </div>
  );
}

function Receipt({ rows, calcError, L }) {
  if (!rows?.length) return null;
  return (
    <details className="receipt" open>
      <summary><Icon name="chevron" size={16} /><span lang={L === LABELS.ur ? 'ur' : undefined}>{L.working}</span></summary>
      <table>
        <caption className="sr-only">How the amount was calculated</caption>
        <tbody>
          {rows.map((c, i) => {
            const last = i === rows.length - 1;
            return (
              <tr key={i} className={last && !calcError ? 'total' : undefined}>
                <th scope="row">
                  <span className="r-label">{c.label}</span>
                  <span className="r-sub">
                    <bdi dir="ltr" className="r-expr">{c.expression}</bdi>
                    {c.source && <> · <bdi dir="ltr">{c.source}</bdi></>}
                  </span>
                </th>
                <td className="r-amt"><bdi dir="ltr">{rs(c.result)}</bdi></td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </details>
  );
}

function Worked({ rules, dateNotes, L }) {
  if (!rules?.length && !dateNotes?.length) return null;
  return (
    <details className="worked">
      <summary><Icon name="chevron" size={16} /><span lang={L === LABELS.ur ? 'ur' : undefined}>{L.how}</span></summary>
      {rules?.length > 0 && (
        <ol className="steps">
          {rules.map((x, i) => (
            <li key={i}>
              <Para as="span" className="step-rule" text={x.rule} />
              <bdi dir="ltr" className="step-src">{x.source}</bdi>
              {x.why?.trim() && <Para as="span" className="step-why" text={`${isUrdu(x.why) ? LABELS.ur.because : LABELS.en.because} ${x.why.trim()}`} />}
            </li>
          ))}
        </ol>
      )}
      {dateNotes?.length > 0 && <Para className="dates" text={`${L.dates}: ${dateNotes.join('; ')}`} />}
    </details>
  );
}

function Meta({ r, id, speech, L }) {
  const meta = r.meta;
  const bits = [];
  if (meta?.ms != null) bits.push(`${(meta.ms / 1000).toFixed(1)} s`);
  if (meta?.cached) bits.push(LABELS.en.fromCache);
  else if (meta?.ai_calls != null) bits.push(LABELS.en.aiCalls(meta.ai_calls));
  const on = speech.speakingId === id;
  return (
    <div className="meta">
      {bits.length > 0 && <span className="meta-bits" dir="ltr">{bits.join(' · ')}</span>}
      {speech.supported && r.status !== 'error' && (
        <button type="button" className="listen" aria-pressed={on} onClick={() => speech.toggle(id, r)}>
          <Icon name={on ? 'stop' : 'speaker'} size={16} />
          <span lang={L === LABELS.ur ? 'ur' : undefined}>{on ? L.stop : L.listen}</span>
        </button>
      )}
    </div>
  );
}

function BotReply({ r, id, onOpen, activeKey, speech, onRetry }) {
  const L = labelsFor(r.language);
  const body = (() => {
    if (r.status === 'loading') return null;
    if (r.status === 'answer') {
      return (
        <>
          {r.parts.map((p, i) => (
            <div key={i} className={`part${p.status === 'not_covered' ? ' part-nc' : ''}`}>
              {r.parts.length > 1 && <Para className="part-q" text={p.question} />}
              {p.status === 'not_covered'
                ? <p className="nc-tag" lang={r.language === 'ur' ? 'ur' : undefined}><Icon name="dash" size={16} />{L.notCovered}</p>
                : <Para className="answer" text={p.answer} />}
              {p.citations?.length > 0 && <Chips citations={p.citations} onOpen={onOpen} activeKey={activeKey} partIndex={i} />}
            </div>
          ))}
          <div className="notes">
            <Note text={r.version_note} />
            <Note text={r.translation_note} />
            <Note text={r.calcError} warn />
          </div>
          <Receipt rows={r.calculation} calcError={r.calcError} L={L} />
          <Worked rules={r.rules} dateNotes={r.date_notes} L={L} />
        </>
      );
    }
    if (r.status === 'clarify') {
      return (
        <>
          <Para className="answer" text={r.question} />
          <Para className="hint" text={L.replyHint} />
          {r.translation_note && <Note text={r.translation_note} />}
        </>
      );
    }
    if (r.status === 'fallback') {
      return (
        <>
          <Para className="body" text={r.message} />
          {r.translation_note && <Note text={r.translation_note} />}
          {r.sources?.length > 0 && (
            <ul className="related">
              {r.sources.map((s, i) => (
                <li key={i}>
                  <bdi dir="ltr" className="related-src">{s.source}</bdi>
                  <Para text={s.text} />
                </li>
              ))}
            </ul>
          )}
        </>
      );
    }
    if (r.status === 'not_covered') return <><Para className="body" text={r.message || r.answer} />{r.translation_note && <Note text={r.translation_note} />}</>;
    return (
      <>
        <Para className="body" text={r.message || r.answer || 'Something went wrong.'} />
        {onRetry
          ? <button type="button" className="retry" onClick={onRetry}><Icon name="retry" size={16} />{L.retry}</button>
          : <Para className="hint" text={L.editHint} />}
      </>
    );
  })();

  return (
    <article className={`reply reply-${r.status}`} aria-busy={r.status === 'loading'}>
      <Band r={r} />
      {body && <div className="reply-body">{body}</div>}
      {r.status !== 'loading' && <Meta r={r} id={id} speech={speech} L={L} />}
    </article>
  );
}

/* ---------- Source panel (side panel on desktop, bottom sheet on phones) ---------- */

function useWide() {
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 1280px)');
    const on = () => setWide(mq.matches);
    on(); mq.addEventListener('change', on);
    return () => mq.removeEventListener('change', on);
  }, []);
  return wide;
}

function SourcePanel({ item, onClose }) {
  const ref = useRef(null);
  const wide = useWide(); // wide: panel sits beside the chat, so it is a plain region with no focus trap
  useEffect(() => {
    if (!item) return;
    const el = ref.current;
    el?.querySelector('.panel-close')?.focus();
    const onKey = e => {
      if (e.key === 'Escape') { e.preventDefault(); onClose(); }
      if (e.key === 'Tab' && el && !wide) {
        const f = el.querySelectorAll('button, [href], [tabindex]:not([tabindex="-1"])');
        if (!f.length) return;
        const first = f[0], last = f[f.length - 1];
        if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
        else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [item, onClose, wide]);

  if (!item) return null;
  const { no, sec } = chipParts(item.source);
  return (
    <>
      {!wide && <div className="scrim" onClick={onClose} aria-hidden="true" />}
      <aside ref={ref} className="panel" role={wide ? 'region' : 'dialog'} aria-modal={wide ? undefined : true} aria-labelledby="panel-title">
        <div className="panel-handle" aria-hidden="true" />
        <header className="panel-head">
          <div>
            <h2 id="panel-title">{no ? <bdi dir="ltr">File {no} · §{sec}</bdi> : item.source}</h2>
            <p className="panel-title-sub">{item.title}</p>
          </div>
          <button type="button" className="panel-close" onClick={onClose} aria-label="Close source">
            <Icon name="close" size={20} />
          </button>
        </header>
        {item.quote
          ? <blockquote className="quote"><Para text={item.quote} /></blockquote>
          : <p className="body">No quote was returned for this source.</p>}
        <p className="panel-file"><bdi dir="ltr">{item.source}</bdi></p>
      </aside>
    </>
  );
}

/* ---------- Voice (browser speech APIs; feature-detected, hidden when unsupported) ---------- */

// What Listen reads: the visible reply, without citation labels, ids and markdown symbols.
function spokenText(r) {
  let parts = [];
  if (r.status === 'answer') {
    parts = r.parts.map(p => (p.status === 'not_covered' ? labelsFor(r.language).notCovered : p.answer));
    if (r.version_note) parts.push(r.version_note);
  } else if (r.status === 'clarify') parts = [r.question];
  else parts = [r.message || r.answer];
  if (r.translation_note) parts.push(r.translation_note);
  return parts.filter(Boolean).join('. ')
    .replace(/\b\d{2}_[\w-]+\.md\b(,?\s*(Section|§)\s*[\d.]+)?/gi, '')
    .replace(/§\s*[\d.]+/g, '')
    .replace(/\[\d{2}:[\d.]+\]/g, '')
    .replace(/[*_#`>|]/g, '')
    .replace(/\(\s*[;,]?\s*\)|\[\s*\]/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

function useSpeechOut() {
  const [supported, setSupported] = useState(false);
  const [speakingId, setSpeakingId] = useState(null);
  const [voices, setVoices] = useState([]);
  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) return undefined;
    setSupported(true);
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener('voiceschanged', load);
    return () => { synth.removeEventListener('voiceschanged', load); synth.cancel(); };
  }, []);
  const stop = useCallback(() => { window.speechSynthesis?.cancel(); setSpeakingId(null); }, []);
  const toggle = useCallback((id, r) => {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speakingId === id) { stop(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(spokenText(r));
    const want = r.language === 'ur' ? 'ur' : 'en'; // Roman Urdu is in Latin letters, so an English voice reads it best
    const byLang = pre => voices.find(v => v.lang?.toLowerCase().startsWith(pre));
    const voice = want === 'ur' ? (byLang('ur') || byLang('hi')) : byLang('en');
    if (voice) u.voice = voice;
    u.lang = voice?.lang || (want === 'ur' ? 'ur-PK' : 'en-US');
    u.onend = u.onerror = () => setSpeakingId(s => (s === id ? null : s));
    setSpeakingId(id);
    synth.speak(u);
  }, [speakingId, voices, stop]);
  return { supported, speakingId, toggle, stop };
}

// Voice input: live (interim) text appended to what was already typed; friendly messages on failure.
function useSpeechIn(getBase, setText) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [lang, setLang] = useState('en'); // 'en' | 'ur'
  const [msg, setMsg] = useState('');
  const recRef = useRef(null);
  useEffect(() => {
    setSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    return () => recRef.current?.abort();
  }, []);
  const stop = useCallback(() => recRef.current?.stop(), []);
  const toggle = useCallback(() => {
    if (listening) { recRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    const rec = new SR();
    rec.lang = lang === 'ur' ? 'ur-PK' : 'en-US';
    rec.interimResults = true;
    rec.continuous = true;
    const base = getBase().trim();
    rec.onresult = e => {
      let said = '';
      for (let k = 0; k < e.results.length; k++) said += e.results[k][0].transcript;
      setText(base ? `${base} ${said.trim()}` : said.trim());
    };
    rec.onerror = e => {
      setMsg(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone blocked. Allow microphone access in the address bar.'
        : e.error === 'no-speech' ? '' : 'Voice input did not work. You can type instead.');
    };
    rec.onend = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    setMsg('');
    setListening(true);
    try { rec.start(); } catch { setListening(false); setMsg('Voice input did not work. You can type instead.'); }
  }, [listening, lang, getBase, setText]);
  return { supported, listening, lang, setLang, toggle, stop, msg };
}

/* ---------- Page ---------- */

export default function Home() {
  const [messages, setMessages] = useState([]); // { role:'user', text } | { role:'bot', text, result }
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [health, setHealth] = useState(null); // null | 'ok' | 'limited'
  const [source, setSource] = useState(null);
  const taRef = useRef(null);
  const lastReplyRef = useRef(null);
  const speech = useSpeechOut();
  const inputRef = useRef('');
  inputRef.current = input;
  const mic = useSpeechIn(useCallback(() => inputRef.current, []), setInput);

  useEffect(() => {
    fetch('/api/health').then(r => r.json()).then(h => {
      const p = h?.providers || {};
      const configured = p.groq?.configured || p.gemini?.configured;
      setHealth(configured ? 'ok' : 'limited');
    }).catch(() => setHealth('limited'));
  }, []);

  // Auto-grow the composer up to its CSS max-height
  useLayoutEffect(() => {
    const ta = taRef.current;
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${ta.scrollHeight}px`;
  }, [input]);

  // Bring the newest reply's band into view
  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    lastReplyRef.current?.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
  }, [messages.length, loading]);

  const closeSource = useCallback(() => {
    setSource(s => { s?.returnTo?.focus(); return null; });
  }, []);

  async function ask(raw) {
    const question = String(raw || '').trim();
    if (!question || loading) return;
    mic.stop();
    speech.stop();
    if (isUrdu(question)) mic.setLang('ur');
    const history = messages.filter(m => m.result?.status !== 'error').map(m => ({ role: m.role, text: m.text }));
    setMessages(m => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    let result;
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      });
      result = await res.json().catch(() => null);
      if (!result) throw new Error(`The server did not reply properly (${res.status}).`);
      if (result.status === 'error' && res.status >= 500) result = { ...result, retryable: true };
      if (result.language) mic.setLang(result.language === 'ur' ? 'ur' : 'en');
    } catch (e) {
      result = { status: 'error', retryable: true, message: navigator.onLine === false ? 'You seem to be offline. Check your connection and try again.' : e.message };
    }
    setMessages(m => [...m, { role: 'bot', text: result.answer || result.message || result.question || '', result, question }]);
    setLoading(false);
    taRef.current?.focus();
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); ask(input); }
  }

  const lastIndex = messages.length - 1;

  return (
    <div className={`shell${source ? ' has-panel' : ''}`}>
      <header className="top">
        <div className="top-in">
          <p className="brand">NovaBot</p>
          <p className="promise">Answers from NovaCart&apos;s policies, with sources</p>
          <p className={`status status-${health || 'pending'}`} role="status">
            <span className="dot" aria-hidden="true" />
            {health === 'ok' ? 'AI available' : health === 'limited' ? 'Limited mode' : 'Checking…'}
          </p>
        </div>
      </header>

      <main className="col" id="chat">
        {messages.length === 0 && (
          <section className="empty" aria-labelledby="empty-title">
            <h1 id="empty-title">Ask about returns, refunds, shipping, warranty or payments.</h1>
            <p className="empty-hint">Include dates and your city. Many rules depend on them.</p>
            <ul className="examples">
              {EXAMPLES.map(ex => (
                <li key={ex.text}>
                  <button type="button" className="example" onClick={() => ask(ex.text)} disabled={loading}>
                    <span className="example-pict"><Icon name={ex.icon} size={22} /></span>
                    <span className="example-main">
                      <Para as="span" className="example-text" text={ex.text} />
                      <span className="example-tag" lang={isUrdu(ex.tag) ? 'ur' : undefined}>{ex.tag}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="log" aria-live="polite" aria-relevant="additions">
          {messages.map((m, i) => (
            m.role === 'user'
              ? <div key={i} className="user"><Para text={m.text} /></div>
              : (
                <div key={i} ref={i === lastIndex && !loading ? lastReplyRef : undefined}>
                  <BotReply r={m.result} id={i} onOpen={setSource} activeKey={source?.key} speech={speech}
                    onRetry={m.result.status === 'error' && m.result.retryable && i === lastIndex && m.question ? () => {
                      setMessages(ms => ms.slice(0, -2));
                      ask(m.question);
                    } : null} />
                </div>
              )
          ))}
          {loading && <div ref={lastReplyRef}><BotReply r={{ status: 'loading', language: isUrdu(messages[messages.length - 1]?.text) ? 'ur' : 'en' }} speech={speech} /></div>}
        </div>
      </main>

      <form className="composer" onSubmit={e => { e.preventDefault(); ask(input); }}>
        {mic.supported && (
          <div className="voice-row">
            <span id="voice-label">Voice language</span>
            <div className="seg" role="group" aria-labelledby="voice-label">
              <button type="button" aria-pressed={mic.lang === 'en'} onClick={() => mic.setLang('en')} disabled={mic.listening}>EN</button>
              <button type="button" aria-pressed={mic.lang === 'ur'} onClick={() => mic.setLang('ur')} disabled={mic.listening} lang="ur">اردو</button>
            </div>
          </div>
        )}
        <div className="composer-in">
          <label htmlFor="q" className="sr-only">Your question</label>
          <textarea
            id="q"
            ref={taRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            dir="auto"
            lang={isUrdu(input) ? 'ur' : undefined}
            className={isUrdu(input) ? 'ur' : undefined}
            placeholder="Type your question…"
            rows={1}
            maxLength={4000}
            disabled={loading}
          />
          {mic.supported && (
            <button type="button" className={`icon-btn${mic.listening ? ' is-on' : ''}`} onClick={mic.toggle}
              aria-pressed={mic.listening} aria-label={mic.listening ? 'Stop voice input' : `Speak your question in ${mic.lang === 'en' ? 'English' : 'Urdu'}`} disabled={loading}>
              <Icon name={mic.listening ? 'stop' : 'mic'} />
            </button>
          )}
          <button type="submit" className="send" disabled={loading || !input.trim()}>
            <span className="send-label">Send</span><Icon name="send" />
          </button>
        </div>
        {(mic.listening || mic.msg) && (
          <p className={`listening${mic.msg ? ' listening-warn' : ''}`} role="status" dir="auto" lang={!mic.msg && mic.lang === 'ur' ? 'ur' : undefined}>
            {mic.msg || (mic.lang === 'ur' ? 'سن رہا ہوں… روکنے کے لیے مائیک دوبارہ دبائیں' : 'Listening… press the mic again to stop')}
          </p>
        )}
      </form>

      <SourcePanel item={source} onClose={closeSource} />
    </div>
  );
}
