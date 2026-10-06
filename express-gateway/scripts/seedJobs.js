/**
 * One-time job ingestion: CSV -> PostgreSQL (companies, jobs, skills, jobs_skills) -> FAISS index (via the AI service).
 * Uses data/jobs.csv (from `npm run fetch-jobs`) and falls back to data/jobs_fallback.csv if it is missing or empty.
 * Re-running replaces the whole job catalogue.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ai } from '../src/aiClient.js';
import { getOrCreateCompany, getOrCreateSkill, initSchema, pool, tx } from '../src/db.js';
import { parseCSV } from '../src/utils/csv.js';
import { findSkills } from '../src/utils/skillsVocab.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.resolve(here, '../data');

function loadRows() {
  for (const file of ['jobs.csv', 'jobs_fallback.csv']) {
    const p = path.join(dataDir, file);
    if (!fs.existsSync(p)) continue;
    const rows = parseCSV(fs.readFileSync(p, 'utf8')).filter((r) => r.title && r.external_id);
    if (rows.length) return { file, rows };
  }
  throw new Error('No job CSV found in data/.');
}

const { file, rows } = loadRows();
if (file === 'jobs_fallback.csv') {
  console.log('data/jobs.csv not found or empty: seeding the three built-in fallback jobs. Run `npm run fetch-jobs` for live jobs.');
}

await initSchema();
await tx(async (c) => {
  await c.query('TRUNCATE TABLE recommendations, jobs_skills, jobs, companies RESTART IDENTITY');
  for (const r of rows) {
    const companyId = await getOrCreateCompany(c, r.company || 'Unknown company', r.industry);
    const { rows: ins } = await c.query(
      `INSERT INTO jobs (company_id, external_id, source, title, description, location, experience_required,
                         education_required, salary_range, employment_type, apply_url, posted_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
       ON CONFLICT (source, external_id) DO NOTHING RETURNING id`,
      [companyId, r.external_id, r.source || 'csv', r.title, r.description, r.location, r.experience_required,
        r.education_required, r.salary_range, r.employment_type, r.apply_url, r.posted_at || null],
    );
    if (!ins[0]) continue;
    const skills = r.skills ? r.skills.split('|').map((s) => s.trim()).filter(Boolean) : findSkills(`${r.title} ${r.description}`);
    for (const name of skills) {
      const skillId = await getOrCreateSkill(c, name);
      await c.query('INSERT INTO jobs_skills (job_id, skill_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [ins[0].id, skillId]);
    }
  }
});

const { rows: jobs } = await pool.query(
  `SELECT j.id AS job_id, j.title, c.name AS company, j.description, j.location, j.experience_required,
          j.education_required, j.employment_type, j.salary_range,
          COALESCE(ARRAY_AGG(s.skill_name ORDER BY s.skill_name) FILTER (WHERE s.id IS NOT NULL), '{}') AS skills
     FROM jobs j
     LEFT JOIN companies c ON c.id = j.company_id
     LEFT JOIN jobs_skills js ON js.job_id = j.id
     LEFT JOIN skills s ON s.id = js.skill_id
    GROUP BY j.id, c.name ORDER BY j.id`,
);
console.log(`Saved ${jobs.length} jobs to PostgreSQL. Embedding them into FAISS (the first run downloads the embedding model and can take a few minutes)...`);

try {
  const { data } = await ai.post('/index/jobs', {
    jobs: jobs.map((j) => ({
      job_id: j.job_id, title: j.title, company: j.company || '', description: j.description || '',
      location: j.location || '', experience_required: j.experience_required || '',
      education_required: j.education_required || '', employment_type: j.employment_type || '',
      salary_range: j.salary_range || '', skills: j.skills,
    })),
  });
  console.log(`Indexed ${data.indexed} jobs in FAISS. Done.`);
} catch (err) {
  console.error(`Could not index jobs in FAISS: ${err.response?.data?.detail || err.message}`);
  console.error('Make sure the AI service is running (uvicorn app.main:app --port 8000) and INTERNAL_API_KEY matches in both .env files, then run `npm run seed` again.');
  process.exitCode = 1;
}
await pool.end();
