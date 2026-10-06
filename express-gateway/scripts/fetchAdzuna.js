/**
 * Pulls live job postings from the Adzuna API and writes them to data/jobs.csv.
 * Then run `npm run seed` to load that CSV into PostgreSQL and the FAISS index.
 */
import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import axios from 'axios';
import { toCSV } from '../src/utils/csv.js';
import { formatSalary, inferEducation, inferExperience, inferType } from '../src/utils/jobText.js';
import { findSkills } from '../src/utils/skillsVocab.js';

const here = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.resolve(here, '../data/jobs.csv');
const { ADZUNA_APP_ID: appId, ADZUNA_APP_KEY: appKey } = process.env;
const country = (process.env.ADZUNA_COUNTRY || 'in').toLowerCase();
const pages = Number(process.env.ADZUNA_PAGES || 2);
const MIN_SKILLS = Number(process.env.MIN_SKILLS || 2);

if (!appId || !appKey) {
  console.error('Set ADZUNA_APP_ID and ADZUNA_APP_KEY in .env (free keys: https://developer.adzuna.com).');
  process.exit(1);
}

const QUERIES = [
  'python developer', 'machine learning engineer', 'data scientist', 'data analyst', 'ai engineer',
  'backend developer', 'full stack developer', 'frontend developer react', 'java developer', 'node.js developer',
  'devops engineer', 'cloud engineer', 'software engineer fresher', 'software developer intern', 'nlp engineer',
];
const COLUMNS = ['external_id', 'title', 'company', 'industry', 'description', 'location', 'experience_required',
  'education_required', 'salary_range', 'employment_type', 'skills', 'apply_url', 'source', 'posted_at'];

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const rows = new Map();

for (const what of QUERIES) {
  for (let page = 1; page <= pages; page += 1) {
    try {
      const { data } = await axios.get(`https://api.adzuna.com/v1/api/jobs/${country}/search/${page}`, {
        params: { app_id: appId, app_key: appKey, results_per_page: 50, what, 'content-type': 'application/json' },
        timeout: 30000,
      });
      for (const j of data.results || []) {
        const id = `adzuna-${j.id}`;
        if (rows.has(id)) continue;
        const description = String(j.description || '').replace(/\s+/g, ' ').trim();
        const skills = findSkills(`${j.title} ${description}`);
        if (skills.length < MIN_SKILLS) continue;
        rows.set(id, {
          external_id: id,
          title: String(j.title || '').replace(/<\/?strong>/g, '').trim(),
          company: j.company?.display_name || 'Unknown company',
          industry: j.category?.label || '',
          description,
          location: j.location?.display_name || '',
          experience_required: inferExperience(j.title, description),
          education_required: inferEducation(description),
          salary_range: formatSalary(j.salary_min, j.salary_max, j.salary_is_predicted, country),
          employment_type: inferType(j.title, j.contract_time, j.contract_type),
          skills: skills.join('|'),
          apply_url: j.redirect_url || '',
          source: 'adzuna',
          posted_at: j.created || '',
        });
      }
      console.log(`"${what}" page ${page}: ${rows.size} usable jobs so far`);
    } catch (err) {
      console.warn(`"${what}" page ${page} failed: ${err.response?.status || err.code || err.message}`);
      if (err.response?.status === 401 || err.response?.status === 403) {
        console.error('Adzuna rejected the credentials. Check ADZUNA_APP_ID and ADZUNA_APP_KEY.');
        process.exit(1);
      }
    }
    await sleep(1000); // stay well inside the free-tier rate limit
  }
}

if (!rows.size) {
  console.error('No jobs were collected, so jobs.csv was not written. The built-in fallback jobs will be used when you seed.');
  process.exit(1);
}
fs.writeFileSync(OUT, toCSV([...rows.values()], COLUMNS), 'utf8');
console.log(`Wrote ${rows.size} jobs to ${OUT}. Next: npm run seed`);
