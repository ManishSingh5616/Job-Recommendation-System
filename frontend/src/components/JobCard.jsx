import { Banknote, ChevronDown, ExternalLink, MapPin } from 'lucide-react';
import { useState } from 'react';
import { Chip, ScoreRing, barColor } from './ui.jsx';

const ROWS = [
  ['skill_match', 'Skills', '35%'],
  ['semantic_similarity', 'Semantic fit', '25%'],
  ['experience_match', 'Experience', '15%'],
  ['education_match', 'Education', '15%'],
  ['preference_match', 'Preferences', '10%'],
];

export default function JobCard({ job }) {
  const [open, setOpen] = useState(false);
  const matched = job.matched_skills || [];
  const missing = job.missing_skills || [];
  const total = matched.length + missing.length;

  return (
    <article className="rounded-lg border border-line bg-white p-4 transition hover:border-teal-300 hover:shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-bold leading-snug">{job.title}</h3>
          <p className="mt-0.5 truncate text-sm text-ink-soft">{job.company}</p>
        </div>
        <ScoreRing value={job.overall_score} size={52} stroke={5} label={`${Math.round(job.overall_score)}%`} />
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-ink-mute">
        {job.location && <span className="inline-flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{job.location}</span>}
        {job.salary && <span className="inline-flex items-center gap-1"><Banknote className="h-3.5 w-3.5" />{job.salary}</span>}
        {job.type && <Chip>{job.type}</Chip>}
        {job.experience && <Chip>{job.experience}</Chip>}
      </div>

      {total > 0 && (
        <div className="mt-3">
          <p className="text-xs font-semibold text-ink-soft">{matched.length} of {total} required skills matched</p>
          {missing.length > 0 && (
            <div className="mt-1.5 flex flex-wrap items-center gap-1">
              <span className="mr-0.5 text-xs font-semibold text-rose-700">Missing:</span>
              {missing.slice(0, 6).map((s) => <Chip key={s} kind="rose">{s}</Chip>)}
              {missing.length > 6 && <span className="text-xs text-ink-mute">+{missing.length - 6} more</span>}
            </div>
          )}
        </div>
      )}

      <div className="mt-3 flex items-center justify-between border-t border-line pt-2.5">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open}
          className="inline-flex items-center gap-1 text-xs font-bold text-teal-700 hover:underline">
          Score breakdown <ChevronDown className={`h-3.5 w-3.5 transition ${open ? 'rotate-180' : ''}`} />
        </button>
        {job.apply_url && (
          <a href={job.apply_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs font-bold text-ink hover:text-teal-700">
            View & apply <ExternalLink className="h-3.5 w-3.5" />
          </a>
        )}
      </div>

      {open && (
        <div className="mt-3 space-y-2">
          {ROWS.map(([key, label, weight]) => {
            const v = job.breakdown?.[key] ?? 0;
            return (
              <div key={key}>
                <div className="flex justify-between text-xs"><span className="font-semibold">{label} <span className="font-normal text-ink-mute">({weight})</span></span><span className="tabular-nums text-ink-mute">{Math.round(v)}%</span></div>
                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-paper"><div className={`h-full rounded-full ${barColor(v)}`} style={{ width: `${v}%` }} /></div>
              </div>
            );
          })}
          {job.description && <p className="pt-1 text-xs leading-relaxed text-ink-mute">{job.description.slice(0, 260)}{job.description.length > 260 ? '…' : ''}</p>}
        </div>
      )}
    </article>
  );
}
