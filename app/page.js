'use client';
import { useEffect, useRef, useState } from 'react';

const EXAMPLES = [
  'Today is 2026-07-01. I bought headphones in Lahore, delivered 2026-06-20. I opened them. Can I return them?',
  'Contact date 2026-08-10: what is the shipping fee for a Rs. 3,000 order to Skardu?',
  'How long does a warranty repair take?',
  'آج 2026-07-10 ہے۔ میں نے لاہور میں 2026-07-01 کو STYLE15 کے ساتھ شرٹ (2,400 روپے) اور پتلون (3,600 روپے) خریدی، 2026-07-05 کو ڈیلیور ہوئی۔ صرف شرٹ واپس کرنی ہے، پسند نہیں آئی۔ کتنے پیسے واپس ملیں گے؟',
  'Aaj 2026-10-26 hai. Mera parcel Muzaffarabad ke liye 2026-10-01 ko dispatch hua tha, abhi tak nahi aaya. Kya karun?',
];

const URDU = /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/;
const hasUrdu = t => URDU.test(String(t || ''));

// UI labels: English by default, Urdu when the reply is in Urdu script
const T = {
  en: { calc: 'Calculation', how: 'How this was worked out', quoted: 'Quoted policy text', related: 'Related policy rules', thinking: 'Checking the policies…', listen: '🔊 Listen', stop: '⏹ Stop', dates: 'Dates', because: 'because' },
  ur: { calc: 'حساب', how: 'یہ جواب کیسے بنا', quoted: 'پالیسی کا حوالہ', related: 'متعلقہ پالیسی قواعد', thinking: 'پالیسی دیکھی جا رہی ہے…', listen: '🔊 سنیں', stop: '⏹ روکیں', dates: 'تاریخیں', because: 'کیونکہ' },
};
const labelsFor = r => (r?.language === 'ur' ? T.ur : T.en);

const rs = n => `Rs. ${Number(n).toLocaleString('en-US')}`;

// Keep amounts, dates, codes and section numbers left-to-right inside Urdu text (<bdi> isolates them).
const LTR_BITS = /(Rs\.?\s?[\d,]+(?:\.\d+)?|\d{4}-\d{2}-\d{2}|\b[A-Z]{3,}\d+\b|\b\d{2}_[\w-]+\.md\b|§\s*[\d.]+|\d[\d,.]*%?)/g;
function Mixed({ text }) {
  const s = String(text || '');
  // English text (e.g. a sentence kept in English) shown inside an Urdu bubble: normal font, left to right
  if (!hasUrdu(s)) return <bdi className="latin">{s}</bdi>;
  return s.split(LTR_BITS).map((bit, i) => (i % 2 ? <bdi key={i} className="ltr">{bit}</bdi> : bit));
}

// Direction and font for a bubble: Urdu script -> right-to-left Nastaliq; otherwise let the browser decide.
const dirProps = (text, language) => (language === 'ur' || hasUrdu(text)
  ? { dir: 'rtl', lang: 'ur', className: 'urdu' }
  : { dir: 'auto', className: '' });

// What 🔊 reads: the visible reply, without citation labels, ids and markdown symbols.
function spokenText(r) {
  let parts = [];
  if (r.status === 'answer') {
    parts = r.parts.map(p => (p.status === 'not_covered' ? r.not_covered_text : p.answer));
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

// Renders one result from lib/pipeline.js (status: answer | clarify | not_covered | fallback | error)
function BotReply({ r }) {
  const L = labelsFor(r);
  const d = dirProps(r.answer, r.language);
  const bubble = children => <div className={`bubble ${d.className}`} dir={d.dir} lang={d.lang}>{children}</div>;
  const note = r.translation_note && <div className="note">{r.translation_note}</div>;

  if (r.status === 'answer') {
    return (
      <>
        {bubble(
          <>
            {r.parts.map((p, i) => (
              <div key={i} className="part">
                {r.parts.length > 1 && <strong className="part-q"><Mixed text={p.question} /></strong>}
                <div><Mixed text={p.status === 'not_covered' ? r.not_covered_text : p.answer} /></div>
                {p.citations?.length > 0 && (
                  <div className="cites ltr" dir="ltr">{[...new Set(p.citations.map(c => c.source))].join(' · ')}</div>
                )}
              </div>
            ))}
            {r.version_note && <div className="note"><Mixed text={r.version_note} /></div>}
            {r.calcError && <div className="note warn"><Mixed text={r.calcError} /></div>}
            {note}
          </>,
        )}
        {r.calculation?.length > 0 && (
          <details className="extra" open>
            <summary>{L.calc}</summary>
            <table dir="ltr">
              <tbody>
                {r.calculation.map((c, i) => (
                  <tr key={i}>
                    <td>{c.label}{c.source && <div className="src">{c.source}</div>}</td>
                    <td><code>{c.expression}</code></td>
                    <td className="num">{rs(c.result)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </details>
        )}
        {(r.rules?.length > 0 || r.date_notes?.length > 0) && (
          <details className="extra">
            <summary>{L.how}</summary>
            {r.rules?.length > 0 && (
              <ol>
                {r.rules.map((x, i) => (
                  <li key={i}>
                    <span dir="ltr">{x.rule} <span className="src">[{x.source}]</span></span>
                    {x.why && <> {L.because} <span {...dirProps(x.why)}><Mixed text={x.why} /></span></>}
                  </li>
                ))}
              </ol>
            )}
            {r.date_notes?.length > 0 && <p className="src" dir="ltr">{L.dates}: {r.date_notes.join('; ')}</p>}
          </details>
        )}
        {r.parts.some(p => p.citations?.length) && (
          <details className="extra">
            <summary>{L.quoted}</summary>
            <ul dir="ltr">
              {r.parts.flatMap(p => p.citations || []).map((c, i) => (
                <li key={i}><strong>{c.source}</strong><span>&ldquo;{c.quote}&rdquo;</span></li>
              ))}
            </ul>
          </details>
        )}
      </>
    );
  }

  if (r.status === 'fallback') {
    return (
      <>
        {bubble(<><Mixed text={r.message} />{note}</>)}
        {r.sources?.length > 0 && (
          <details className="extra" open>
            <summary>{L.related}</summary>
            <ul dir="ltr">{r.sources.map((s, i) => <li key={i}><strong>{s.source}</strong><span>{s.text}</span></li>)}</ul>
          </details>
        )}
      </>
    );
  }

  const text = r.status === 'clarify' ? r.question : (r.message || r.answer);
  return bubble(<><Mixed text={text} />{note}</>);
}

export default function Home() {
  // { role: 'user', text } | { role: 'bot', text, result, error? }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  // Voice: support is detected on the client only (avoids a hydration mismatch)
  const [micSupported, setMicSupported] = useState(false);
  const [ttsSupported, setTtsSupported] = useState(false);
  const [micLang, setMicLang] = useState('en-US'); // follows the language of the customer's last message
  const [listening, setListening] = useState(false);
  const [micMsg, setMicMsg] = useState('');
  const [speaking, setSpeaking] = useState(null); // index of the reply being read aloud
  const [voices, setVoices] = useState([]);
  const recRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  useEffect(() => {
    setMicSupported(!!(window.SpeechRecognition || window.webkitSpeechRecognition));
    const synth = window.speechSynthesis;
    if (!synth) return () => recRef.current?.abort();
    setTtsSupported(true);
    const load = () => setVoices(synth.getVoices());
    load();
    synth.addEventListener('voiceschanged', load);
    return () => {
      synth.removeEventListener('voiceschanged', load);
      synth.cancel();
      recRef.current?.abort();
    };
  }, []);

  const lastUserText = [...messages].reverse().find(m => m.role === 'user')?.text || '';
  const uiUrdu = hasUrdu(lastUserText);

  function stopSpeaking() {
    window.speechSynthesis?.cancel();
    setSpeaking(null);
  }

  function speak(i, r) {
    const synth = window.speechSynthesis;
    if (!synth) return;
    if (speaking === i) { stopSpeaking(); return; }
    synth.cancel();
    const u = new SpeechSynthesisUtterance(spokenText(r));
    const want = r.language === 'ur' ? 'ur' : 'en'; // Roman Urdu is in Latin letters, so an English voice reads it best
    const byLang = p => voices.find(v => v.lang?.toLowerCase().startsWith(p));
    const voice = want === 'ur' ? (byLang('ur') || byLang('hi')) : byLang('en');
    if (voice) u.voice = voice;
    u.lang = voice?.lang || (want === 'ur' ? 'ur-PK' : 'en-US');
    u.onend = u.onerror = () => setSpeaking(s => (s === i ? null : s));
    setSpeaking(i);
    synth.speak(u);
  }

  function toggleMic() {
    if (listening) { recRef.current?.stop(); return; }
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) return;
    stopSpeaking();
    const rec = new SR();
    rec.lang = micLang;
    rec.interimResults = true;
    rec.continuous = true;
    const base = input.trim();
    rec.onresult = e => {
      let said = '';
      for (let k = 0; k < e.results.length; k++) said += e.results[k][0].transcript;
      setInput(base ? `${base} ${said.trim()}` : said.trim());
    };
    rec.onerror = e => {
      setMicMsg(e.error === 'not-allowed' || e.error === 'service-not-allowed'
        ? 'Microphone blocked: allow mic access in the address bar.'
        : e.error === 'no-speech' ? '' : "Voice input didn't work, you can type instead.");
    };
    rec.onend = () => { setListening(false); recRef.current = null; };
    recRef.current = rec;
    setMicMsg('');
    setListening(true);
    try { rec.start(); } catch { setListening(false); setMicMsg("Voice input didn't work, you can type instead."); }
  }

  async function ask(raw) {
    const question = raw.trim();
    if (!question || loading) return;
    recRef.current?.stop();
    stopSpeaking();
    if (hasUrdu(question)) setMicLang('ur-PK');
    const history = messages.filter(m => !m.error).map(m => ({ role: m.role, text: m.text }));
    setMessages(m => [...m, { role: 'user', text: question }]);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question, history }),
      });
      const data = await res.json().catch(() => null);
      if (!data) throw new Error(`Request failed (${res.status})`);
      if (data.language) setMicLang(data.language === 'en' ? 'en-US' : 'ur-PK');
      const isError = data.status === 'error';
      setMessages(m => [...m, { role: 'bot', text: data.answer || data.message || '', result: data, error: isError }]);
    } catch (e) {
      setMessages(m => [...m, { role: 'bot', text: e.message, result: { status: 'error', message: e.message }, error: true }]);
    } finally {
      setLoading(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); ask(input); }
  }

  const inputUrdu = hasUrdu(input);

  return (
    <main className="shell">
      <header className="top">
        <h1>NovaCart Policy Assistant</h1>
        <p>Answers come only from NovaCart&apos;s policy files, with the sections cited. Include dates and your city in the question. <span lang="ur" dir="rtl" className="urdu-inline">اردو میں بھی پوچھ سکتے ہیں</span></p>
      </header>

      <section className="chat" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">
            <p>Try one of these:</p>
            {EXAMPLES.map(ex => {
              const d = dirProps(ex);
              return <button key={ex} className={`example ${d.className}`} dir={d.dir} lang={d.lang} onClick={() => ask(ex)}>{ex}</button>;
            })}
          </div>
        )}

        {messages.map((m, i) => {
          if (m.role === 'user') {
            const d = dirProps(m.text);
            return (
              <div key={i} className="msg user">
                <div className={`bubble ${d.className}`} dir={d.dir} lang={d.lang}><Mixed text={m.text} /></div>
              </div>
            );
          }
          const r = { not_covered_text: 'This is not covered in the NovaCart policy files.', ...m.result };
          const L = labelsFor(r);
          return (
            <div key={i} className={`msg bot${m.error ? ' error' : ''}`}>
              <BotReply r={r} />
              {ttsSupported && !m.error && (
                <button type="button" className={`listen ${r.language === 'ur' ? 'urdu' : ''}`} onClick={() => speak(i, r)} aria-pressed={speaking === i}>
                  {speaking === i ? L.stop : L.listen}
                </button>
              )}
            </div>
          );
        })}

        {loading && (
          <div className="msg bot">
            <div className={`bubble thinking ${uiUrdu ? 'urdu' : ''}`} dir={uiUrdu ? 'rtl' : 'auto'}>{uiUrdu ? T.ur.thinking : T.en.thinking}</div>
          </div>
        )}
        <div ref={endRef} />
      </section>

      <form className="composer" onSubmit={e => { e.preventDefault(); ask(input); }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about returns, refunds, shipping, warranty…  اردو میں بھی پوچھ سکتے ہیں"
          rows={2}
          maxLength={4000}
          dir="auto"
          lang={inputUrdu ? 'ur' : undefined}
          className={inputUrdu ? 'urdu' : ''}
          aria-label="Your question"
        />
        <div className="controls">
          {micSupported && (
            <>
              <button
                type="button"
                className={`mic${listening ? ' on' : ''}`}
                onClick={toggleMic}
                aria-pressed={listening}
                aria-label={listening ? 'Stop voice input' : 'Speak your question'}
                title={listening ? 'Stop' : 'Speak your question'}
              >🎤</button>
              <button
                type="button"
                className="mic-lang"
                onClick={() => setMicLang(l => (l === 'ur-PK' ? 'en-US' : 'ur-PK'))}
                disabled={listening}
                title="Voice input language (tap to switch)"
                aria-label={`Voice input language: ${micLang === 'ur-PK' ? 'Urdu' : 'English'}. Tap to switch.`}
              >{micLang === 'ur-PK' ? 'اردو' : 'EN'}</button>
            </>
          )}
          <button type="submit" className="ask" disabled={loading || !input.trim()}>Ask</button>
        </div>
        {(listening || micMsg) && (
          <div className={`mic-hint${micMsg ? ' warn' : ''}`} dir="auto" role="status">
            {micMsg || (micLang === 'ur-PK' ? 'سن رہا ہوں… روکنے کے لیے 🎤 دبائیں' : 'Listening… tap 🎤 to stop')}
          </div>
        )}
      </form>
    </main>
  );
}
