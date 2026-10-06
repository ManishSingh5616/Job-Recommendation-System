import { ai } from '../aiClient.js';
import { query, tx } from '../db.js';

export async function latestResume(userId) {
  const { rows } = await query(
    'SELECT id, filename, parsed_json, ats_json, uploaded_at FROM resumes WHERE user_id = $1 ORDER BY id DESC LIMIT 1',
    [userId],
  );
  return rows[0] || null;
}

const JOB_COLUMNS = `j.title, j.description, j.location, j.experience_required, j.salary_range,
  j.employment_type, j.apply_url, j.source, c.name AS company`;

const shape = (r) => ({
  job_id: r.job_id,
  title: r.title,
  company: r.company || '',
  location: r.location || '',
  salary: r.salary_range || '',
  type: r.employment_type || '',
  experience: r.experience_required || '',
  apply_url: r.apply_url || '',
  source: r.source || '',
  description: (r.description || '').slice(0, 700),
  overall_score: Number(r.score),
  breakdown: {
    skill_match: Number(r.skill_match),
    semantic_similarity: Number(r.semantic_similarity),
    experience_match: Number(r.experience_match),
    education_match: Number(r.education_match),
    preference_match: Number(r.preference_match),
  },
  matched_skills: r.matched_skills || [],
  missing_skills: r.missing_skills || [],
});

async function loadCached(userId, resumeId) {
  const { rows } = await query(
    `SELECT r.*, ${JOB_COLUMNS}
       FROM recommendations r
       JOIN jobs j ON j.id = r.job_id
       LEFT JOIN companies c ON c.id = j.company_id
      WHERE r.user_id = $1 AND r.resume_id = $2
      ORDER BY r.score DESC`,
    [userId, resumeId],
  );
  return rows.map(shape);
}

/** Returns the top-20 matches for the user's latest resume, from the cache unless refresh is requested. */
export async function getRecommendations(userId, resume, { refresh = false } = {}) {
  if (!refresh) {
    const cached = await loadCached(userId, resume.id);
    if (cached.length) return { recommendations: cached, indexedJobs: null };
  }

  const { data } = await ai.post('/recommend', { profile: resume.parsed_json || {}, top_k: 20 });
  const items = data.recommendations || [];
  if (!items.length) return { recommendations: [], indexedJobs: data.indexed_jobs ?? 0 };

  const { rows: existing } = await query('SELECT id FROM jobs WHERE id = ANY($1::int[])', [items.map((i) => i.job_id)]);
  const valid = new Set(existing.map((r) => r.id));

  await tx(async (c) => {
    await c.query('DELETE FROM recommendations WHERE user_id = $1', [userId]);
    for (const it of items) {
      if (!valid.has(it.job_id)) continue;
      await c.query(
        `INSERT INTO recommendations
          (user_id, resume_id, job_id, score, skill_match, semantic_similarity, experience_match,
           education_match, preference_match, matched_skills, missing_skills)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [userId, resume.id, it.job_id, it.overall_score, it.breakdown.skill_match, it.breakdown.semantic_similarity,
          it.breakdown.experience_match, it.breakdown.education_match, it.breakdown.preference_match,
          JSON.stringify(it.matched_skills || []), JSON.stringify(it.missing_skills || [])],
      );
    }
  });
  return { recommendations: await loadCached(userId, resume.id), indexedJobs: data.indexed_jobs };
}
