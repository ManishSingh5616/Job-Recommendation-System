import { BookOpen, Briefcase, FileText, Send, Sparkles, Square, Target } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Link } from 'react-router-dom';
import { api, streamChat } from '../api.js';
import { Chip, Spinner } from '../components/ui.jsx';

const SUGGESTIONS = [
  'Which skills should I learn first?',
  'Why is my top job a good fit for me?',
  'How can I improve my ATS score?',
  'Which jobs am I closest to qualifying for?',
];

const MD = {
  p: ({ node, ...p }) => <p className="mb-2 leading-relaxed last:mb-0" {...p} />,
  ul: ({ node, ...p }) => <ul className="mb-2 list-disc space-y-1.5 pl-5 last:mb-0" {...p} />,
  ol: ({ node, ...p }) => <ol className="mb-2 list-decimal space-y-1.5 pl-5 last:mb-0" {...p} />,
  li: ({ node, ...p }) => <li className="leading-relaxed" {...p} />,
  strong: ({ node, ...p }) => <strong className="font-bold text-ink" {...p} />,
  h1: ({ node, ...p }) => <h3 className="mb-1.5 mt-3 text-base font-extrabold first:mt-0" {...p} />,
  h2: ({ node, ...p }) => <h3 className="mb-1.5 mt-3 text-base font-extrabold first:mt-0" {...p} />,
  h3: ({ node, ...p }) => <h4 className="mb-1.5 mt-3 text-sm font-extrabold uppercase tracking-wide text-teal-800 first:mt-0" {...p} />,
  code: ({ node, ...p }) => <code className="rounded bg-paper px-1 py-0.5 text-[0.85em]" {...p} />,
  a: ({ node, ...p }) => <a className="font-semibold text-teal-700 underline" target="_blank" rel="noopener noreferrer" {...p} />,
};

function Sources({ sources }) {
  if (!sources?.length) return null;
  const jobs = sources.filter((s) => s.type === 'job');
  const resume = sources.filter((s) => s.type === 'resume').length;
  const gap = sources.some((s) => s.type === 'skill_gap');
  const ats = sources.some((s) => s.type === 'ats');
  return (
    <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-line pt-2.5">
      <span className="text-[11px] font-bold uppercase tracking-wide text-ink-mute">Based on</span>
      {resume > 0 && <Chip><FileText className="mr-1 h-3 w-3" />Resume ({resume})</Chip>}
      {gap && <Chip><Target className="mr-1 h-3 w-3" />Skill gaps</Chip>}
      {ats && <Chip><BookOpen className="mr-1 h-3 w-3" />ATS report</Chip>}
      {jobs.slice(0, 3).map((j) => <Chip key={j.job_id}><Briefcase className="mr-1 h-3 w-3" />{j.title}</Chip>)}
      {jobs.length > 3 && <span className="text-xs text-ink-mute">+{jobs.length - 3} jobs</span>}
    </div>
  );
}

export default function Assistant() {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [hasResume, setHasResume] = useState(null);
  const abortRef = useRef(null);
  const endRef = useRef(null);

  useEffect(() => { api.latestResume().then((r) => setHasResume(Boolean(r.resume))).catch(() => setHasResume(true)); }, []);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' }); }, [messages]);
  useEffect(() => () => abortRef.current?.abort(), []);

  const send = async (text) => {
    const q = (text ?? input).trim();
    if (!q || streaming) return;
    const history = messages.filter((m) => !m.error && m.content).map(({ role, content }) => ({ role, content }));
    setMessages((m) => [...m, { role: 'user', content: q }, { role: 'assistant', content: '', sources: [], pending: true }]);
    setInput('');
    setStreaming(true);
    const ctrl = new AbortController();
    abortRef.current = ctrl;
    const patchLast = (fn) => setMessages((m) => m.map((x, i) => (i === m.length - 1 ? fn(x) : x)));
    try {
      for await (const ev of streamChat(q, history, ctrl.signal)) {
        if (ev.type === 'sources') patchLast((x) => ({ ...x, sources: ev.sources }));
        else if (ev.type === 'token') patchLast((x) => ({ ...x, content: x.content + ev.text, pending: false }));
      }
      patchLast((x) => ({ ...x, pending: false }));
    } catch (e) {
      if (e.name === 'AbortError') patchLast((x) => ({ ...x, pending: false, content: x.content || '_Stopped._' }));
      else patchLast((x) => ({ ...x, pending: false, error: true, content: e.message }));
    } finally {
      setStreaming(false);
      abortRef.current = null;
    }
  };

  const onKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) { e.preventDefault(); send(); }
  };

  return (
    <div className="card flex h-[calc(100vh-9rem)] flex-col overflow-hidden lg:h-[calc(100vh-4rem)]">
      <header className="flex items-center gap-3 border-b border-line px-5 py-4">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-50 text-teal-700"><Sparkles className="h-5 w-5" /></div>
        <div>
          <h1 className="text-base font-extrabold leading-tight">Career assistant</h1>
          <p className="text-xs text-ink-mute">Answers from your resume, job matches, skill gaps and ATS report</p>
        </div>
      </header>

      <div className="flex-1 overflow-y-auto px-5 py-5">
        {hasResume === false && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
            Upload your resume first so the assistant has something to work with. <Link to="/" className="font-bold underline">Go to resume upload</Link>
          </div>
        )}

        {messages.length === 0 ? (
          <div className="mx-auto flex max-w-xl flex-col items-center py-10 text-center">
            <h2 className="text-xl font-extrabold tracking-tight">What would you like to know?</h2>
            <p className="mt-1.5 text-sm text-ink-mute">Ask about your fit for a role, which skills to build, or how to strengthen your resume.</p>
            <div className="mt-6 grid w-full gap-2 sm:grid-cols-2">
              {SUGGESTIONS.map((s) => (
                <button key={s} onClick={() => send(s)} disabled={hasResume === false}
                  className="rounded-lg border border-line bg-white px-4 py-3 text-left text-sm font-semibold transition hover:border-teal-400 hover:bg-teal-50/50 disabled:opacity-50">{s}</button>
              ))}
            </div>
          </div>
        ) : (
          <div className="mx-auto max-w-3xl space-y-5">
            {messages.map((m, i) => m.role === 'user' ? (
              <div key={i} className="flex justify-end"><div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-ink px-4 py-2.5 text-sm text-white">{m.content}</div></div>
            ) : (
              <div key={i} className="flex gap-3">
                <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Sparkles className="h-4 w-4" /></div>
                <div className={`min-w-0 flex-1 rounded-2xl rounded-tl-md border px-4 py-3 text-sm ${m.error ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-line bg-white'}`}>
                  {m.pending ? <span className="inline-flex items-center gap-2 text-ink-mute"><Spinner /> Thinking…</span>
                    : m.error ? m.content : <ReactMarkdown components={MD}>{m.content}</ReactMarkdown>}
                  {!m.pending && !m.error && <Sources sources={m.sources} />}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </div>

      <footer className="border-t border-line bg-paper/60 p-4">
        <div className="mx-auto flex max-w-3xl items-end gap-2">
          <textarea value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={onKeyDown} rows={1} disabled={hasResume === false}
            placeholder="Ask about your skills, jobs or resume…" aria-label="Your question"
            className="input max-h-36 min-h-[2.75rem] flex-1 resize-none" />
          {streaming ? (
            <button onClick={() => abortRef.current?.abort()} className="btn btn-ghost !px-3.5" aria-label="Stop generating"><Square className="h-4 w-4" /></button>
          ) : (
            <button onClick={() => send()} disabled={!input.trim() || hasResume === false} className="btn btn-primary !px-3.5" aria-label="Send"><Send className="h-4 w-4" /></button>
          )}
        </div>
      </footer>
    </div>
  );
}
