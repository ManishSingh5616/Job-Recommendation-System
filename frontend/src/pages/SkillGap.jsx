import { Target } from 'lucide-react';
import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api.js';
import { Chip, EmptyState, PageHeader, Spinner } from '../components/ui.jsx';

const PRIORITY = {
  High: { chip: 'rose', bar: 'bg-rose-500', label: 'Start here' },
  Medium: { chip: 'amber', bar: 'bg-amber-500', label: 'Next' },
  Low: { chip: 'neutral', bar: 'bg-ink-mute/60', label: 'Later' },
};

export default function SkillGap() {
  const [state, setState] = useState({ status: 'loading' });

  useEffect(() => {
    api.skillGap().then((data) => setState({ status: 'ready', data })).catch((e) => setState({ status: 'error', message: e.message }));
  }, []);

  if (state.status === 'loading') return <div className="flex justify-center py-20 text-teal-700"><Spinner className="h-6 w-6" /></div>;
  if (state.status === 'error') return <p className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">{state.message}</p>;

  const d = state.data;
  const goUpload = <Link to="/" className="btn btn-primary">Go to resume upload</Link>;

  return (
    <>
      <PageHeader title="Skill gap analysis"
        subtitle={d.available && !d.empty ? `Based on your top ${d.total_jobs} job matches. Skills are ranked by how many of those jobs require them.` : 'See which skills stand between you and your best-matching jobs.'} />

      {!d.available && <div className="card"><EmptyState icon={Target} title="Upload your resume first" action={goUpload}>The analysis compares your skills with the jobs matched to your resume.</EmptyState></div>}
      {d.available && d.empty && <div className="card"><EmptyState icon={Target} title="No job matches yet" action={goUpload}>Open the resume page first so your matches are generated, then come back.</EmptyState></div>}

      {d.available && !d.empty && (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
          <section className="card p-6">
            <h2 className="text-base font-bold">Skills to learn, ranked by priority</h2>
            {d.skills.length === 0 ? (
              <p className="mt-4 text-sm text-ink-mute">You already have every skill your top matches ask for.</p>
            ) : (
              <ul className="mt-5 space-y-5">
                {d.skills.slice(0, 15).map((s) => (
                  <li key={s.skill}>
                    <div className="flex items-center justify-between gap-3">
                      <span className="font-bold">{s.skill}</span>
                      <div className="flex items-center gap-2.5">
                        <span className="text-sm tabular-nums text-ink-mute">{s.jobs_count} of {s.total_jobs} jobs</span>
                        <Chip kind={PRIORITY[s.priority].chip}>{s.priority}</Chip>
                      </div>
                    </div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-paper" role="img" aria-label={`${s.skill}: required by ${s.percent}% of jobs`}>
                      <div className={`h-full rounded-full ${PRIORITY[s.priority].bar}`} style={{ width: `${s.percent}%`, transition: 'width .6s ease' }} />
                    </div>
                    {s.example_jobs?.length > 0 && <p className="mt-1.5 text-xs text-ink-mute">e.g. {s.example_jobs.join(', ')}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="space-y-6">
            {d.quick_wins?.length > 0 && (
              <section className="card p-6">
                <h2 className="text-base font-bold">Quick wins</h2>
                <p className="mt-1 text-sm text-ink-mute">Jobs that are only one or two skills away from a full skills match.</p>
                <ul className="mt-4 space-y-2.5">
                  {d.quick_wins.map((q) => (
                    <li key={q.skill} className="flex items-center justify-between rounded-lg bg-paper px-3.5 py-2.5 text-sm">
                      <span className="font-bold">{q.skill}</span>
                      <span className="text-ink-mute">closes the gap for <span className="font-bold text-teal-700">{q.jobs_unlocked}</span> {q.jobs_unlocked === 1 ? 'job' : 'jobs'}</span>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {d.roadmap?.length > 0 && (
              <section className="card p-6">
                <h2 className="text-base font-bold">Learning roadmap</h2>
                <ol className="mt-5 space-y-6">
                  {d.roadmap.map((step, i) => (
                    <li key={step.priority} className="relative pl-11">
                      <span className="absolute left-0 top-0 flex h-8 w-8 items-center justify-center rounded-full bg-ink text-sm font-bold text-white">{i + 1}</span>
                      {i < d.roadmap.length - 1 && <span className="absolute left-4 top-9 h-[calc(100%-0.5rem)] w-px bg-line" aria-hidden />}
                      <h3 className="font-bold">{PRIORITY[step.priority].label}</h3>
                      <p className="mt-0.5 text-sm text-ink-mute">{step.reason}</p>
                      <div className="mt-2.5 flex flex-wrap gap-1.5">{step.skills.map((s) => <Chip key={s} kind={PRIORITY[step.priority].chip}>{s}</Chip>)}</div>
                    </li>
                  ))}
                </ol>
              </section>
            )}
          </div>
        </div>
      )}
    </>
  );
}
