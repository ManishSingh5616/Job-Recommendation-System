# AI-Powered Career Intelligence and Job Recommendation System

Upload a resume, see the extracted profile and an ATS score, get ranked job matches with the skills you are
missing, see a skill-gap roadmap, and ask a RAG career assistant questions.

```
frontend (React + Vite + Tailwind)  ->  express-gateway (Node + Express)  ->  ai-service (FastAPI)
login, dashboard, chat UI               JWT auth, uploads, PostgreSQL         Gemini, embeddings, FAISS, scoring, RAG
                                        http://localhost:5000                 http://localhost:8000
shared/skills_vocab.json  -> one skill vocabulary used by both back ends
```

## Run it (3 terminals)

**0. PostgreSQL** - create an empty database: `CREATE DATABASE career_intelligence;` (tables are created automatically).

**1. AI service**
```
cd ai-service
python -m venv venv && venv\Scripts\activate        # Windows (use source venv/bin/activate on Linux/macOS)
pip install -r requirements.txt
copy .env.example .env                              # then fill GEMINI_API_KEY and INTERNAL_API_KEY
uvicorn app.main:app --port 8000
```
The first request downloads the `intfloat/multilingual-e5-large` model (about 2 GB). That is a one-time download.

**2. Gateway** (the AI service must already be running for the seed step)
```
cd express-gateway
npm install
copy .env.example .env     # DATABASE_URL (URL-encode special characters, @ becomes %40), JWT_SECRET, INTERNAL_API_KEY (same as ai-service)
npm run fetch-jobs         # optional: live jobs from Adzuna into data/jobs.csv (needs ADZUNA_APP_ID / ADZUNA_APP_KEY)
npm run seed               # CSV -> PostgreSQL -> FAISS. Without jobs.csv it loads the 3 built-in fallback jobs
npm start
```

**3. Frontend**
```
cd frontend
npm install
copy .env.example .env
npm run dev                # http://localhost:5173
```

## How it works
1. **Upload** - the gateway (Multer) forwards the file to the AI service, which extracts the text (pdfplumber / python-docx).
2. **Extraction** - the whole resume is split into chunks, every chunk goes to Gemini, results are merged and
   de-duplicated. If Gemini is unreachable a keyword fallback returns only what it finds (nothing is invented).
3. **Storage** - profile, ATS result and skills are saved in PostgreSQL (`resumes`, `users_skills`, ...).
4. **Jobs** - come from a CSV (Adzuna export or the fallback file), loaded once by `npm run seed` into `jobs`, `jobs_skills`,
   `companies`, and embedded into a local FAISS index.
5. **Recommendation** - FAISS finds semantically similar jobs; each is scored with the synopsis weights:
   skills 0.35, semantic 0.25, experience 0.15, education 0.15, preference 0.10.
6. **Skill gap** - missing skills are counted across the top 20 jobs and ranked (High >= 50% of jobs, Medium >= 25%).
7. **Assistant** - your resume is embedded per user; each question retrieves the best resume passages and combines them with
   your top jobs, skill gaps and ATS report. Gemini answers from that context and the reply streams token by token.

## Technology used
Everything in the synopsis: Node.js, Express, Axios, Multer, JWT, bcrypt, FastAPI, Uvicorn, PostgreSQL, FAISS-CPU,
Sentence Transformers (multilingual-e5-large), Gemini API, React, Vite, TailwindCSS, Git.

Added beyond the synopsis (all small):
- `bcryptjs` - pure-JavaScript bcrypt, avoids native build problems on Windows.
- `react-router-dom` - page routing and the login redirect.
- `react-markdown` - renders the assistant's bullet-point answers.
- `lucide-react` - icons (already in your original project).
- `pg` - the PostgreSQL driver for Node. `httpx` - only for the AI service tests.
- The frontend uses the browser `fetch` instead of Axios, because Axios cannot stream responses in the browser.

## Things to know
- **Semantic score calibration**: raw e5 similarities for related text sit in a narrow high band, so they are rescaled with
  `SEM_FLOOR=0.70` and `SEM_CEIL=0.88` (set in `ai-service/.env` to change). These two numbers are my estimate; check them against
  real similarity values from your own data.
- Gemini model names come from your original code (`GEMINI_MODELS`). Change them there if your key uses different ones.
- Rotate the Gemini key and database password that were in your old `.env` / `database.py`.

## Tests
```
cd ai-service && python tests/test_core.py        # 8 offline tests (fake embedder and fake Gemini)
cd express-gateway && npm test                    # CSV, skill vocabulary and job-text utilities
```
