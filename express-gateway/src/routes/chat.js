import { Router } from 'express';
import { ai, aiFailure } from '../aiClient.js';
import { requireAuth } from '../middleware/auth.js';
import { getRecommendations, latestResume } from '../services/recommendations.js';

const router = Router();

router.post('/stream', requireAuth, async (req, res, next) => {
  try {
    const message = String(req.body?.message || '').trim().slice(0, 1500);
    if (!message) return res.status(400).json({ error: 'Type a question first.' });
    const history = (Array.isArray(req.body?.history) ? req.body.history : [])
      .filter((m) => m && ['user', 'assistant'].includes(m.role) && typeof m.content === 'string')
      .slice(-8)
      .map((m) => ({ role: m.role, content: m.content.slice(0, 2000) }));

    const resume = await latestResume(req.user.id);
    if (!resume) return res.status(400).json({ error: 'Upload your resume first so the assistant has something to work with.' });
    const { recommendations } = await getRecommendations(req.user.id, resume);

    const upstream = await ai.post('/chat/stream', {
      user_id: req.user.id,
      query: message,
      history,
      profile: resume.parsed_json || {},
      recommendations: recommendations.map((r) => ({
        job_id: r.job_id, title: r.title, company: r.company, overall_score: r.overall_score,
        missing_skills: r.missing_skills, matched_skills: r.matched_skills,
      })),
      ats: resume.ats_json,
    }, { responseType: 'stream', timeout: 0 });

    res.set({
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();
    upstream.data.pipe(res);
    req.on('close', () => upstream.data.destroy());
    upstream.data.on('error', () => res.end());
  } catch (err) {
    if (res.headersSent) return res.end();
    if (err.isAxiosError) {
      const { status, message } = aiFailure(err);
      return res.status(status).json({ error: message });
    }
    next(err);
  }
});

export default router;
