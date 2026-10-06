import { ArrowRight, Compass } from 'lucide-react';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { Chip, ScoreRing, Spinner } from '../components/ui.jsx';
import { useAuth } from '../context/AuthContext.jsx';

export default function AuthPage() {
  const { user, login, register } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  if (user) return <Navigate to="/" replace />;
  const isRegister = mode === 'register';
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setError('');
    setBusy(true);
    try {
      if (isRegister) await register(form.name, form.email, form.password);
      else await login(form.email, form.password);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid min-h-full lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden flex-col justify-between overflow-hidden bg-ink p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-600"><Compass className="h-5 w-5" /></div>
          <span className="text-sm font-extrabold tracking-tight">Career Intelligence</span>
        </div>

        <div>
          <h2 className="max-w-md text-4xl font-extrabold leading-[1.15] tracking-tight">Know which jobs fit your resume, and exactly what to learn next.</h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-white/65">Upload your resume once. We read it, score it for applicant tracking systems, rank real job openings and show the skills standing between you and each one.</p>

          <div className="mt-10 max-w-sm rounded-xl bg-white p-4 text-ink shadow-2xl shadow-black/30">
            <div className="mb-3 text-[11px] font-bold uppercase tracking-wider text-ink-mute">Illustrative example</div>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="font-bold">Backend Python Developer</div>
                <div className="text-xs text-ink-mute">Sample company, Remote</div>
              </div>
              <ScoreRing value={82} size={52} stroke={5} />
            </div>
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Chip kind="teal">Python</Chip><Chip kind="teal">FastAPI</Chip><Chip kind="teal">PostgreSQL</Chip>
              <Chip kind="rose">Docker</Chip><Chip kind="rose">AWS</Chip>
            </div>
          </div>
        </div>
        <p className="text-xs text-white/40">Rule-based weighted scoring with semantic search. Your resume stays in your own database.</p>
      </section>

      <section className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-sm">
          <h1 className="text-2xl font-extrabold tracking-tight">{isRegister ? 'Create your account' : 'Welcome back'}</h1>
          <p className="mt-1.5 text-sm text-ink-mute">{isRegister ? 'Start matching your resume to jobs.' : 'Sign in to see your matches.'}</p>

          <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
            {isRegister && (
              <div>
                <label htmlFor="name" className="label">Full name</label>
                <input id="name" className="input" autoComplete="name" value={form.name} onChange={set('name')} required />
              </div>
            )}
            <div>
              <label htmlFor="email" className="label">Email</label>
              <input id="email" type="email" className="input" autoComplete="email" value={form.email} onChange={set('email')} required />
            </div>
            <div>
              <label htmlFor="password" className="label">Password</label>
              <input id="password" type="password" className="input" autoComplete={isRegister ? 'new-password' : 'current-password'}
                value={form.password} onChange={set('password')} placeholder={isRegister ? 'At least 8 characters' : ''} required />
            </div>
            <div aria-live="polite" className="min-h-[1.25rem] text-sm font-medium text-rose-600">{error}</div>
            <button type="submit" disabled={busy} className="btn btn-primary w-full">
              {busy ? <Spinner /> : null}{isRegister ? 'Create account' : 'Sign in'}{!busy && <ArrowRight className="h-4 w-4" />}
            </button>
          </form>

          <p className="mt-6 text-center text-sm text-ink-mute">
            {isRegister ? 'Already have an account?' : 'New here?'}{' '}
            <button type="button" className="font-bold text-teal-700 hover:underline" onClick={() => { setMode(isRegister ? 'login' : 'register'); setError(''); }}>
              {isRegister ? 'Sign in' : 'Create an account'}
            </button>
          </p>
        </div>
      </section>
    </div>
  );
}
