import { AlertTriangle, Award, Briefcase, GraduationCap, Mail, Phone, Rocket } from 'lucide-react';
import { Chip } from './ui.jsx';

function Section({ icon: Icon, title, children }) {
  return (
    <div className="border-t border-line pt-4">
      <h3 className="mb-2.5 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-ink-mute"><Icon className="h-3.5 w-3.5" />{title}</h3>
      {children}
    </div>
  );
}

export default function ProfileCard({ profile, extraction }) {
  const p = profile || {};
  const exp = p.experience || [];
  const edu = p.education || [];
  const projects = p.projects || [];
  const certs = p.certifications || [];

  return (
    <section className="card p-6" aria-label="Extracted profile">
      {extraction?.mode === 'fallback' && (
        <div className="mb-4 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>The AI model was unreachable, so this is a basic keyword extraction. Names, skills and education are real, but experience is not filled in. Upload again later for the full analysis.</span>
        </div>
      )}
      {extraction?.chunks_failed > 0 && extraction?.mode === 'llm' && (
        <div className="mb-4 flex gap-2.5 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{extraction.chunks_failed} of {extraction.chunks} parts of your resume could not be analysed, so some details may be missing.</span>
        </div>
      )}

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-extrabold tracking-tight">{p.name || 'Candidate'}</h2>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-mute">
            {p.email && <span className="inline-flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" />{p.email}</span>}
            {p.phone && <span className="inline-flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" />{p.phone}</span>}
          </div>
        </div>
        <Chip kind="teal">{p.total_years ?? 0} yrs experience</Chip>
      </div>

      <div className="mt-5 space-y-4">
        <Section icon={Award} title={`Skills (${(p.skills || []).length})`}>
          {p.skills?.length ? (
            <div className="flex flex-wrap gap-1.5">{p.skills.map((s) => <Chip key={s} kind="teal">{s}</Chip>)}</div>
          ) : <p className="text-sm text-ink-mute">No skills were detected.</p>}
        </Section>

        {edu.length > 0 && (
          <Section icon={GraduationCap} title="Education">
            <ul className="space-y-2">
              {edu.map((e, i) => (
                <li key={i} className="text-sm"><span className="font-semibold">{e.degree}</span>
                  <span className="text-ink-mute">{[e.institution, e.year].filter(Boolean).map((x) => ` · ${x}`).join('')}</span></li>
              ))}
            </ul>
          </Section>
        )}

        {exp.length > 0 && (
          <Section icon={Briefcase} title="Experience">
            <ul className="space-y-2">
              {exp.map((e, i) => (
                <li key={i} className="text-sm"><span className="font-semibold">{e.role}</span>
                  <span className="text-ink-mute">{e.company ? ` at ${e.company}` : ''}{e.duration ? ` · ${e.duration}` : ''}</span></li>
              ))}
            </ul>
          </Section>
        )}

        {projects.length > 0 && (
          <Section icon={Rocket} title="Projects">
            <ul className="space-y-2.5">
              {projects.map((pr, i) => (
                <li key={i} className="text-sm">
                  <div className="font-semibold">{pr.name}</div>
                  {pr.technologies?.length > 0 && <div className="mt-1 flex flex-wrap gap-1">{pr.technologies.map((t) => <Chip key={t}>{t}</Chip>)}</div>}
                </li>
              ))}
            </ul>
          </Section>
        )}

        {certs.length > 0 && (
          <Section icon={Award} title="Certifications">
            <ul className="list-inside list-disc space-y-1 text-sm">{certs.map((c) => <li key={c}>{c}</li>)}</ul>
          </Section>
        )}
      </div>
    </section>
  );
}
