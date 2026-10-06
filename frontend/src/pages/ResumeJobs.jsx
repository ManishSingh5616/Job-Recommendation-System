import { Briefcase, FileUp, RefreshCw, UploadCloud } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { api } from '../api.js';
import AtsCard from '../components/AtsCard.jsx';
import JobCard from '../components/JobCard.jsx';
import ProfileCard from '../components/ProfileCard.jsx';
import { EmptyState, PageHeader, Spinner } from '../components/ui.jsx';

const MAX_BYTES = 5 * 1024 * 1024;

function JobSkeleton() {
  return (
    <div className="animate-pulse space-y-3" aria-hidden>
      {[0, 1, 2].map((i) => (
        <div key={i} className="rounded-lg border border-line p-4">
          <div className="h-4 w-2/3 rounded bg-paper" /><div className="mt-2 h-3 w-1/3 rounded bg-paper" />
          <div className="mt-4 h-3 w-full rounded bg-paper" />
        </div>
      ))}
    </div>
  );
}

export default function ResumeJobs() {
  const [resume, setResume] = useState(null);
  const [extraction, setExtraction] = useState(null);
  const [recs, setRecs] = useState([]);
  const [recStatus, setRecStatus] = useState('idle');
  const [recError, setRecError] = useState('');
  const [indexed, setIndexed] = useState(null);
  const [initial, setInitial] = useState(true);
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [drag, setDrag] = useState(false);
  const inputRef = useRef(null);

  const loadRecs = useCallback(async () => {
    setRecStatus('loading');
    setRecError('');
    try {
      const r = await api.recommendations();
      setRecs(r.recommendations || []);
      setIndexed(r.indexedJobs);
      setRecStatus('done');
    } catch (e) {
      setRecError(e.message);
      setRecStatus('error');
    }
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.latestResume();
        if (r.resume) { setResume(r.resume); loadRecs(); }
      } catch (e) {
        setError(e.message);
      } finally {
        setInitial(false);
      }
    })();
  }, [loadRecs]);

  const pick = (f) => {
    if (!f) return;
    if (!/\.(pdf|docx)$/i.test(f.name)) return setError('Only PDF and DOCX files are supported.');
    if (f.size > MAX_BYTES) return setError('The file is larger than 5 MB.');
    setError('');
    setFile(f);
  };

  const analyze = async () => {
    if (!file) return;
    setBusy(true);
    setError('');
    try {
      const r = await api.uploadResume(file);
      setResume({ filename: r.filename, uploaded_at: new Date().toISOString(), profile: r.profile, ats: r.ats });
      setExtraction(r.extraction);
      setFile(null);
      setRecs([]);
      loadRecs();
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <PageHeader title="Resume & job matches" subtitle="Upload your resume to extract your profile, score it for ATS and rank matching jobs." />
      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_26rem]">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold">{resume ? 'Upload a new resume' : 'Upload your resume'}</h2>
              {resume && <span className="truncate text-xs text-ink-mute">Current: {resume.filename}</span>}
            </div>

            <div
              onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
              onDragLeave={() => setDrag(false)}
              onDrop={(e) => { e.preventDefault(); setDrag(false); pick(e.dataTransfer.files?.[0]); }}
              className={`mt-4 flex flex-col items-center rounded-xl border-2 border-dashed px-6 py-9 text-center transition ${drag ? 'border-teal-600 bg-teal-50' : 'border-line bg-paper/60'}`}
            >
              <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white text-teal-700 shadow-sm">
                {file ? <FileUp className="h-5 w-5" /> : <UploadCloud className="h-5 w-5" />}
              </div>
              {file ? (
                <p className="mt-3 text-sm font-semibold">{file.name} <span className="font-normal text-ink-mute">({(file.size / 1024).toFixed(0)} KB)</span></p>
              ) : (
                <p className="mt-3 text-sm font-semibold">Drag your resume here, or choose a file</p>
              )}
              <p className="mt-1 text-xs text-ink-mute">PDF or DOCX, up to 5 MB</p>
              <input ref={inputRef} type="file" accept=".pdf,.docx" className="hidden" onChange={(e) => { pick(e.target.files?.[0]); e.target.value = ''; }} />
              <button type="button" onClick={() => inputRef.current?.click()} disabled={busy} className="btn btn-ghost mt-4">Choose file</button>
            </div>

            <div aria-live="polite" className="mt-3 min-h-[1.25rem] text-sm font-medium text-rose-600">{error}</div>
            <button type="button" onClick={analyze} disabled={!file || busy} className="btn btn-primary mt-2 w-full">
              {busy ? <><Spinner /> Analysing your resume…</> : 'Analyse resume'}
            </button>
            {busy && <p className="mt-2 text-center text-xs text-ink-mute">Reading every section, extracting skills and scoring ATS readiness. This can take up to a minute.</p>}
          </section>

          {initial && <div className="card flex justify-center p-10 text-teal-700"><Spinner className="h-6 w-6" /></div>}
          {resume && <><ProfileCard profile={resume.profile} extraction={extraction} /><AtsCard ats={resume.ats} /></>}
        </div>

        <aside className="lg:sticky lg:top-8">
          <section className="card flex max-h-[calc(100vh-4rem)] flex-col" aria-label="Recommended jobs">
            <div className="flex items-center justify-between border-b border-line px-5 py-4">
              <div>
                <h2 className="flex items-center gap-2 text-base font-bold"><Briefcase className="h-4 w-4 text-teal-700" />Recommended jobs</h2>
                {recStatus === 'done' && recs.length > 0 && <p className="mt-0.5 text-xs text-ink-mute">Top {recs.length}, best match first</p>}
              </div>
              {recStatus === 'error' && <button onClick={loadRecs} className="btn btn-ghost !px-3 !py-1.5 text-xs"><RefreshCw className="h-3.5 w-3.5" />Retry</button>}
            </div>

            <div className="flex-1 space-y-3 overflow-y-auto p-4">
              {!resume && !initial && <EmptyState icon={Briefcase} title="No matches yet">Upload your resume and your best-fitting jobs will appear here with the skills you are missing.</EmptyState>}
              {recStatus === 'loading' && <><p className="flex items-center gap-2 px-1 text-sm text-ink-mute"><Spinner /> Matching your profile against jobs…</p><JobSkeleton /></>}
              {recStatus === 'error' && <p className="rounded-lg border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800">{recError}</p>}
              {recStatus === 'done' && recs.length === 0 && (
                <EmptyState icon={Briefcase} title={indexed === 0 ? 'No jobs in the database yet' : 'No matching jobs found'}>
                  {indexed === 0 ? 'Load jobs first by running "npm run seed" in the express-gateway folder, then reload this page.' : 'Try uploading a more detailed resume.'}
                </EmptyState>
              )}
              {recStatus === 'done' && recs.map((job) => <JobCard key={job.job_id} job={job} />)}
            </div>
          </section>
        </aside>
      </div>
    </>
  );
}
