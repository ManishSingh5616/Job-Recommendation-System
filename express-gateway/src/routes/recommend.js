import { Router } from 'express';
import { aiFailure } from '../aiClient.js';
import { requireAuth } from '../middleware/auth.js';
import { getRecommendations, latestResume } from '../services/recommendations.js';

const router = Router();

router.get('/', requireAuth, async (req, res, next) => {
  try {
    const resume = await latestResume(req.user.id);
    if (!resume) return res.json({ recommendations: [], indexedJobs: null, hasResume: false });
    const result = await getRecommendations(req.user.id, resume, { refresh: req.query.refresh === '1' });
    res.json({ ...result, hasResume: true });
  } catch (err) {
    if (err.isAxiosError) {
      const { status, message } = aiFailure(err);
      return res.status(status).json({ error: message });
    }
    next(err);
  }
});

export default router;
