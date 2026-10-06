import { Loader2 } from 'lucide-react';

export const tone = (v) => (v >= 75 ? 'teal' : v >= 50 ? 'amber' : 'rose');
const STROKE = { teal: '#0F766E', amber: '#D97706', rose: '#E11D48' };
const BAR = { teal: 'bg-teal-600', amber: 'bg-amber-500', rose: 'bg-rose-500' };
export const barColor = (v) => BAR[tone(v)];

export function ScoreRing({ value = 0, size = 56, stroke = 6, label, sub }) {
  const pct = Math.max(0, Math.min(100, value));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E4E1D8" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={STROKE[tone(pct)]} strokeWidth={stroke}
          strokeLinecap="round" strokeDasharray={c} strokeDashoffset={c * (1 - pct / 100)}
          style={{ transition: 'stroke-dashoffset .7s ease' }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-extrabold leading-none" style={{ fontSize: size * 0.3 }}>{label ?? Math.round(pct)}</span>
        {sub && <span className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-ink-mute">{sub}</span>}
      </div>
    </div>
  );
}

const CHIP = {
  neutral: 'border-line bg-paper text-ink-soft',
  teal: 'border-teal-200 bg-teal-50 text-teal-800',
  rose: 'border-rose-200 bg-rose-50 text-rose-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
};
export function Chip({ children, kind = 'neutral', className = '' }) {
  return <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-xs font-medium ${CHIP[kind]} ${className}`}>{children}</span>;
}

export const Spinner = ({ className = 'h-4 w-4' }) => <Loader2 className={`animate-spin ${className}`} aria-hidden />;

export function EmptyState({ icon: Icon, title, children, action }) {
  return (
    <div className="flex flex-col items-center px-6 py-12 text-center">
      {Icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-teal-50 text-teal-700"><Icon className="h-6 w-6" /></div>}
      <h3 className="text-base font-bold">{title}</h3>
      <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-mute">{children}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function PageHeader({ title, subtitle, children }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="text-2xl font-extrabold tracking-tight">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-ink-mute">{subtitle}</p>}
      </div>
      {children}
    </div>
  );
}
