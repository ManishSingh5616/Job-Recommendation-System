CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  email VARCHAR(150) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS resumes (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  filename VARCHAR(255),
  raw_text TEXT NOT NULL,
  parsed_json JSONB,
  ats_json JSONB,
  uploaded_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_resumes_user ON resumes (user_id, id DESC);

CREATE TABLE IF NOT EXISTS skills (
  id SERIAL PRIMARY KEY,
  skill_name VARCHAR(100) NOT NULL,
  category VARCHAR(50)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_skills_lower ON skills (LOWER(skill_name));

CREATE TABLE IF NOT EXISTS users_skills (
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  proficiency VARCHAR(20),
  PRIMARY KEY (user_id, skill_id)
);

CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  industry VARCHAR(100)
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_companies_lower ON companies (LOWER(name));

CREATE TABLE IF NOT EXISTS jobs (
  id SERIAL PRIMARY KEY,
  company_id INT REFERENCES companies(id) ON DELETE SET NULL,
  external_id VARCHAR(100) NOT NULL,
  source VARCHAR(30) NOT NULL,
  title VARCHAR(250) NOT NULL,
  description TEXT,
  location VARCHAR(150),
  experience_required VARCHAR(50),
  education_required VARCHAR(100),
  salary_range VARCHAR(80),
  employment_type VARCHAR(30),
  apply_url TEXT,
  posted_at TIMESTAMPTZ
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_jobs_source_ext ON jobs (source, external_id);

CREATE TABLE IF NOT EXISTS jobs_skills (
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  skill_id INT NOT NULL REFERENCES skills(id) ON DELETE CASCADE,
  required BOOLEAN DEFAULT TRUE,
  PRIMARY KEY (job_id, skill_id)
);

CREATE TABLE IF NOT EXISTS recommendations (
  id SERIAL PRIMARY KEY,
  user_id INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  resume_id INT NOT NULL REFERENCES resumes(id) ON DELETE CASCADE,
  job_id INT NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
  score DOUBLE PRECISION,
  skill_match DOUBLE PRECISION,
  semantic_similarity DOUBLE PRECISION,
  experience_match DOUBLE PRECISION,
  education_match DOUBLE PRECISION,
  preference_match DOUBLE PRECISION,
  matched_skills JSONB DEFAULT '[]',
  missing_skills JSONB DEFAULT '[]',
  generated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_recs_user ON recommendations (user_id, score DESC);
