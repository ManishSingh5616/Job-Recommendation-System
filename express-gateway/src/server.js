import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import { initSchema } from './db.js';
import authRoutes from './routes/auth.js';
import chatRoutes from './routes/chat.js';
import recommendRoutes from './routes/recommend.js';
import resumeRoutes from './routes/resume.js';
import skillGapRoutes from './routes/skillGap.js';

for (const key of ['DATABASE_URL', 'JWT_SECRET']) {
  if (!process.env[key]) {
    console.error(`Missing ${key}. Copy .env.example to .env and fill it in.`);
    process.exit(1);
  }
}

const app = express();
app.use(cors({ origin: (process.env.CORS_ORIGIN || 'http://localhost:5173').split(',') }));
app.use(express.json({ limit: '1mb' }));

app.get('/api/health', (req, res) => res.json({ status: 'online', service: 'gateway' }));
app.use('/api/auth', authRoutes);
app.use('/api/resume', resumeRoutes);
app.use('/api/recommendations', recommendRoutes);
app.use('/api/skill-gap', skillGapRoutes);
app.use('/api/chat', chatRoutes);

// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  console.error(err);
  res.status(500).json({ error: 'Something went wrong on the server.' });
});

await initSchema();
const port = Number(process.env.PORT || 5000);
app.listen(port, () => console.log(`Gateway listening on http://localhost:${port}`));
