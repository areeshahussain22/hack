'use client';
import { useEffect, useRef, useState } from 'react';

const EXAMPLES = [
  'Today is 2026-07-01. I bought headphones in Lahore, delivered 2026-06-20. I opened them. Can I return them?',
  'Contact date 2026-08-10: what is the shipping fee for a Rs. 3,000 order to Skardu?',
  'How long does a warranty repair take?',
];

const rs = n => `Rs. ${Number(n).toLocaleString('en-US')}`;

// Renders one result from lib/pipeline.js (status: answer | clarify | not_covered | fallback | error)
function BotReply({ r }) {
  if (r.status === 'answer') {
    return (
      <>
        <div className="bubble">
          {r.parts.map((p, i) => (
            <div key={i} className="part">
              {r.parts.length > 1 && <strong className="part-q">{p.question}</strong>}
              <div>{p.status === 'not_covered' ? r.not_covered_text : p.answer}</div>
              {p.citations?.length > 0 && (
                <div className="cites">{[...new Set(p.citations.map(c => c.source))].join(' · ')}</div>
              )}
            </div>
          ))}
          {r.version_note && <div className="note">{r.version_note}</div>}
          {r.calcError && <div className="note warn">{r.calcError}</div>}
        </div>
        {r.calculation?.length > 0 && (
          <details className="extra" open>
            <summary>Calculation</summary>
            <table>
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
            <summary>How this was worked out</summary>
            {r.rules?.length > 0 && (
              <ol>
                {r.rules.map((x, i) => <li key={i}>{x.rule} <span className="src">[{x.source}]</span>{x.why && <> because {x.why}</>}</li>)}
              </ol>
            )}
            {r.date_notes?.length > 0 && <p className="src">Dates: {r.date_notes.join('; ')}</p>}
          </details>
        )}
        {r.parts.some(p => p.citations?.length) && (
          <details className="extra">
            <summary>Quoted policy text</summary>
            <ul>
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
        <div className="bubble">{r.message}</div>
        {r.sources?.length > 0 && (
          <details className="extra" open>
            <summary>Related policy rules</summary>
            <ul>{r.sources.map((s, i) => <li key={i}><strong>{s.source}</strong><span>{s.text}</span></li>)}</ul>
          </details>
        )}
      </>
    );
  }

  const text = r.status === 'clarify' ? r.question : (r.message || r.answer);
  return <div className="bubble">{text}</div>;
}

export default function Home() {
  // { role: 'user', text } | { role: 'bot', text, result, error? }
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const endRef = useRef(null);

  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, loading]);

  async function ask(raw) {
    const question = raw.trim();
    if (!question || loading) return;
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

  return (
    <main className="shell">
      <header className="top">
        <h1>NovaCart Policy Assistant</h1>
        <p>Answers come only from NovaCart&apos;s policy files, with the sections cited. Include dates and your city in the question.</p>
      </header>

      <section className="chat" aria-live="polite">
        {messages.length === 0 && (
          <div className="empty">
            <p>Try one of these:</p>
            {EXAMPLES.map(ex => (
              <button key={ex} className="example" onClick={() => ask(ex)}>{ex}</button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`msg ${m.role}${m.error ? ' error' : ''}`}>
            {m.role === 'user'
              ? <div className="bubble">{m.text}</div>
              : <BotReply r={{ not_covered_text: 'This is not covered in the NovaCart policy files.', ...m.result }} />}
          </div>
        ))}

        {loading && <div className="msg bot"><div className="bubble thinking">Checking the policies…</div></div>}
        <div ref={endRef} />
      </section>

      <form className="composer" onSubmit={e => { e.preventDefault(); ask(input); }}>
        <textarea
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Ask about returns, refunds, shipping, warranty, payments…"
          rows={2}
          maxLength={4000}
          aria-label="Your question"
        />
        <button type="submit" disabled={loading || !input.trim()}>Ask</button>
      </form>
    </main>
  );
}
