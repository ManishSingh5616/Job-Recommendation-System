import { Lightbulb } from 'lucide-react';
import { ScoreRing, barColor } from './ui.jsx';

export default function AtsCard({ ats }) {
  if (!ats) return null;
  return (
    <section className="card p-6" aria-label="ATS score">
      <div className="flex items-center gap-5">
        <ScoreRing value={ats.score} size={104} stroke={9} sub="of 100" />
        <div>
          <h2 className="text-lg font-extrabold tracking-tight">ATS resume score</h2>
          <p className="mt-0.5 text-sm font-semibold text-teal-700">{ats.grade}</p>
          <p className="mt-1 max-w-xs text-sm leading-relaxed text-ink-mute">How easily applicant tracking systems can read your resume and match it to a job.</p>
        </div>
      </div>

      <ul className="mt-6 space-y-3.5">
        {ats.breakdown.map((b) => {
          const pct = Math.round((b.score / b.max) * 100);
          return (
            <li key={b.key}>
              <div className="flex items-baseline justify-between text-sm">
                <span className="font-semibold">{b.label}</span>
                <span className="tabular-nums text-ink-mute">{b.score}/{b.max}</span>
              </div>
              <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-paper" role="img" aria-label={`${b.label}: ${pct}%`}>
                <div className={`h-full rounded-full ${barColor(pct)}`} style={{ width: `${pct}%`, transition: 'width .6s ease' }} />
              </div>
              <p className="mt-1 text-xs text-ink-mute">{b.detail}</p>
            </li>
          );
        })}
      </ul>

      {ats.suggestions?.length > 0 && (
        <div className="mt-6 rounded-lg bg-teal-50/70 p-4">
          <h3 className="mb-2 flex items-center gap-2 text-sm font-bold text-teal-900"><Lightbulb className="h-4 w-4" />How to improve</h3>
          <ul className="list-inside list-disc space-y-1.5 text-sm leading-relaxed text-teal-950/80">
            {ats.suggestions.map((s) => <li key={s}>{s}</li>)}
          </ul>
        </div>
      )}
    </section>
  );
}
