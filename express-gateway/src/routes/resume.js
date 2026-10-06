import path from 'node:path';
import { Router } from 'express';
import multer from 'multer';
import { ai, aiFailure } from '../aiClient.js';
import { getOrCreateSkill, query, tx } from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { latestResume } from '../services/recommendations.js';

const router = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.pdf' || ext === '.docx') return cb(null, true);
    cb(new Error('Only PDF and DOCX files are supported.'));
  },
});

const handleUpload = (req, res, next) =>
  upload.single('file')(req, res, (err) => {
    if (!err) return next();
    const message = err.code === 'LIMIT_FILE_SIZE' ? 'The file is larger than 5 MB.' : err.message;
    res.status(400).json({ error: message });
  });

router.post('/upload', requireAuth, handleUpload, async (req, res, next) => {
  if (!req.file) return res.status(400).json({ error: 'Choose a PDF or DOCX resume to upload.' });
  let analysis;
  try {
    const { data } = await ai.post('/resume/analyze', {
      user_id: req.user.id,
      filename: req.file.originalname,
      content_b64: req.file.buffer.toString('base64'),
    });
    analysis = data;
  } catch (err) {
    const { status, message } = aiFailure(err);
    return res.status(status).json({ error: message });
  }

  try {
    const { profile, ats, raw_text: rawText, extraction } = analysis;
    const resumeId = await tx(async (c) => {
      const { rows } = await c.query(
        'INSERT INTO resumes (user_id, filename, raw_text, parsed_json, ats_json) VALUES ($1,$2,$3,$4,$5) RETURNING id',
        [req.user.id, req.file.originalname, rawText, JSON.stringify(profile), JSON.stringify(ats)],
      );
      await c.query('DELETE FROM users_skills WHERE user_id = $1', [req.user.id]);
      for (const name of profile.skills || []) {
        const skillId = await getOrCreateSkill(c, name);
        await c.query('INSERT INTO users_skills (user_id, skill_id) VALUES ($1,$2) ON CONFLICT DO NOTHING', [req.user.id, skillId]);
      }
      await c.query('DELETE FROM recommendations WHERE user_id = $1', [req.user.id]); // stale for the new resume
      return rows[0].id;
    });
    res.status(201).json({ resume_id: resumeId, filename: req.file.originalname, profile, ats, extraction });
  } catch (err) { next(err); }
});

router.get('/latest', requireAuth, async (req, res, next) => {
  try {
    const r = await latestResume(req.user.id);
    if (!r) return res.json({ resume: null });
    res.json({ resume: { id: r.id, filename: r.filename, uploaded_at: r.uploaded_at, profile: r.parsed_json, ats: r.ats_json } });
  } catch (err) { next(err); }
});

export default router;
