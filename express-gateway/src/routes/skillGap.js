import { Router } from 'express';
import { ai, aiFailure } from '../aiClient.js';
import { requireAuth } from '../middleware/auth.js';
import { getRecommendations, latestResume } from '../services/recommendations.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const resume = await latestResume(req.user.id);
    if (!resume) return res.json({ available: false });
    const { recommendations } = await getRecommendations(req.user.id, resume);
    if (!recommendations.length) return res.json({ available: true, empty: true, total_jobs: 0 });
    const { data } = await ai.post('/skill-gap', {
      recommendations: recommendations.map((r) => ({
        job_id: r.job_id, title: r.title, company: r.company,
        missing_skills: r.missing_skills, matched_skills: r.matched_skills,
      })),
    });
    res.json({ available: true, empty: false, ...data });
  } catch (err) {
    if (err.isAxiosError) {
      const { status, message } = aiFailure(err);
      return res.status(status).json({ error: message });
    }
    next(err);
  }
});

export default router;
