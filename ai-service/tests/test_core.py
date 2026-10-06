"""Offline checks for the AI service. Run from ai-service/:  python tests/test_core.py
The embedding model and Gemini are replaced by small fakes so no downloads or API keys are needed."""
import base64
import hashlib
import io
import json
import os
import re
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
os.environ["FAISS_DIR"] = tempfile.mkdtemp()
os.environ["INTERNAL_API_KEY"] = "test-key"
os.environ.pop("GEMINI_API_KEY", None)

import numpy as np  # noqa: E402
from docx import Document  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.services import embeddings, llm  # noqa: E402

DIM = 128


def _vec(text: str) -> np.ndarray:
    v = np.zeros(DIM, dtype="float32")
    for tok in re.findall(r"[a-z0-9+#.]+", text.lower()):
        v[int(hashlib.md5(tok.encode()).hexdigest(), 16) % DIM] += 1
    n = np.linalg.norm(v)
    return v / n if n else v


embeddings.embed_passages = lambda texts, batch_size=16: np.stack([_vec(t) for t in texts])
embeddings.embed_query = lambda text: _vec(text)

from app.main import app  # noqa: E402
from app.services import ats, extractor, scoring, skill_gap  # noqa: E402
from app.services.skills_vocab import find_skills, normalize_skill  # noqa: E402

RESUME = """Ayrisha Ray
ayrisha@example.com | +91 98765 43210 | linkedin.com/in/ayrisha | github.com/ayrisha

SUMMARY
Final-year B.Tech student interested in AI engineering and backend development.

EDUCATION
B.Tech in Computer Science and Engineering, BIT Mesra, 2027

TECHNICAL SKILLS
Python, SQL, FastAPI, PostgreSQL, React, Git, Docker, FAISS, LangChain

EXPERIENCE
Research Intern, DRDO
- Built a retrieval pipeline over 2,000 documents using FAISS and Python
- Reduced query latency by 35% by tuning chunk sizes
- Collaborated with a team of 4 engineers on an offline RAG system

PROJECTS
Career Intelligence System
- Developed a resume parser using Gemini API and PostgreSQL
- Implemented rule-based job scoring with ReactJS dashboard

CERTIFICATIONS
Google Cloud Fundamentals
"""


def test_vocab():
    assert normalize_skill("ReactJS") == "React"
    found = find_skills("Used Node.js, C++ and JavaScript; also postgres, not javascripty")
    assert {"Node.js", "C++", "JavaScript", "PostgreSQL"} <= set(found), found
    assert "Java" not in find_skills("I know JavaScript only")


def test_chunking_covers_everything():
    lines = [f"line number {i} with some filler words to take space" for i in range(400)]
    text = "\n".join(lines)
    chunks = extractor.chunk_text(text, 2000, 200)
    assert len(chunks) > 3 and all(len(c) <= 2000 for c in chunks)
    joined = "\n".join(chunks)
    assert all(l in joined for l in lines), "a line was lost between chunks"
    assert extractor.chunk_text("short", 2000, 200) == ["short"]


def test_chunked_llm_extraction_and_merge():
    calls = []

    def fake_json(prompt, temperature=0.1):
        calls.append(prompt)
        if "Input:" in prompt:  # consolidation pass
            return json.loads(prompt.split("Input:\n", 1)[1])
        part = int(re.search(r"part (\d+) of", prompt).group(1))
        if part == 1:
            return {"name": "Ayrisha Ray", "skills": ["ReactJS", "Python"],
                    "education": [{"degree": "B.Tech CSE", "institution": "BIT Mesra", "year": "2027"}],
                    "experience": [{"role": "Intern", "company": "DRDO", "duration": "6 months", "years": 0.5}]}
        return {"skills": ["React.js", "Docker"], "experience": [{"role": "intern", "company": "drdo", "years": 0.5}],
                "projects": [{"name": "Career System", "description": "x", "technologies": ["FastAPI"]}]}

    old = llm.generate_json
    llm.generate_json = fake_json
    try:
        big = RESUME + "\n" + "\n".join(f"Extra detail line {i} about work done on various systems" for i in range(300))
        profile, meta = extractor.extract_profile(big)
    finally:
        llm.generate_json = old
    assert meta["chunks"] > 1 and meta["chunks_failed"] == 0 and meta["mode"] == "llm"
    assert len(calls) == meta["chunks"] + 1, "every chunk plus one consolidation call"
    assert profile["skills"].count("React") == 1 and "Docker" in profile["skills"]
    assert len(profile["experience"]) == 1 and profile["total_years"] == 0.5
    assert profile["email"] == "ayrisha@example.com" and profile["phone"].startswith("+91")


def test_fallback_does_not_invent():
    profile, meta = extractor.extract_profile(RESUME)
    assert meta["mode"] == "fallback"
    assert profile["experience"] == [] and profile["preferences"]["location"] == ""
    assert "Python" in profile["skills"] and profile["name"] == "Ayrisha Ray"


def test_ats():
    good = ats.score_resume(RESUME)
    assert 0 < good["score"] <= 100 and len(good["breakdown"]) == 7
    assert sum(i["max"] for i in good["breakdown"]) == 100
    weak = ats.score_resume("Some Name\nI like computers and many other things in life, generally speaking.")
    assert weak["score"] < good["score"] and weak["suggestions"]


def test_scoring():
    assert scoring.compute_skill_match(["python", "ReactJS"], ["Python", "React", "AWS"]) == 2 / 3
    assert scoring.find_missing_skills(["python"], ["Python", "AWS"]) == ["AWS"]
    assert scoring.parse_min_years("1-3 years") == 1 and scoring.parse_min_years("5+ years") == 5
    assert scoring.compute_experience_match(0, "3+ years") == 0.2
    assert scoring.compute_education_match(["B.Tech CSE"], "Bachelor's Degree") == 1.0
    assert scoring.compute_education_match(["B.Tech CSE"], "Master's Degree") == 0.6
    assert scoring.compute_preference_match({}, "x", "y") == 0.5
    assert abs(scoring.calculate_compatibility(1, 1, 1, 1, 1) - 1.0) < 1e-9


def test_skill_gap():
    recs = [{"title": f"Job {i}", "missing_skills": ["AWS"] + (["Kafka"] if i < 2 else []), "matched_skills": ["Python"]} for i in range(10)]
    recs[9]["missing_skills"] = ["AWS"]
    gap = skill_gap.analyze_skill_gap(recs)
    assert gap["skills"][0]["skill"] == "AWS" and gap["skills"][0]["percent"] == 100 and gap["skills"][0]["priority"] == "High"
    assert any(p["priority"] == "Low" for p in gap["roadmap"])
    assert gap["quick_wins"][0]["skill"] == "AWS"


JOBS = [
    {"job_id": 1, "title": "Junior AI/RAG Engineer", "company": "Meridian AI", "description": "Build RAG systems with FAISS LangChain and FastAPI",
     "location": "Bengaluru", "experience_required": "0-2 years", "education_required": "Bachelor's Degree", "employment_type": "Full-Time",
     "salary_range": "8-12 LPA", "skills": ["Python", "RAG", "FAISS", "LangChain", "FastAPI", "AWS"]},
    {"job_id": 2, "title": "Frontend Developer", "company": "Brightpath", "description": "Build React interfaces with TailwindCSS and JavaScript",
     "location": "Hyderabad", "experience_required": "1-3 years", "education_required": "Bachelor's Degree", "employment_type": "Full-Time",
     "salary_range": "6-10 LPA", "skills": ["React", "JavaScript", "TailwindCSS", "Git"]},
]


def test_http_flow():
    c = TestClient(app, headers={"X-Internal-Key": "test-key"})
    assert TestClient(app).post("/recommend", json={"profile": {}}).status_code == 401
    assert c.get("/health").json()["status"] == "online"

    assert c.post("/index/jobs", json={"jobs": JOBS}).json()["indexed"] == 2

    doc = Document()
    for line in RESUME.split("\n"):
        doc.add_paragraph(line)
    buf = io.BytesIO()
    doc.save(buf)
    r = c.post("/resume/analyze", json={"user_id": 7, "filename": "cv.docx", "content_b64": base64.b64encode(buf.getvalue()).decode()})
    assert r.status_code == 200, r.text
    body = r.json()
    assert body["extraction"]["chunks_indexed"] >= 1 and body["ats"]["score"] > 0

    bad = c.post("/resume/analyze", json={"user_id": 7, "filename": "cv.txt", "content_b64": base64.b64encode(b"hello").decode()})
    assert bad.status_code == 422

    rec = c.post("/recommend", json={"profile": body["profile"], "top_k": 20}).json()
    assert rec["indexed_jobs"] == 2 and rec["recommendations"][0]["job_id"] == 1
    top = rec["recommendations"][0]
    assert "AWS" in top["missing_skills"] and top["overall_score"] > rec["recommendations"][1]["overall_score"]

    enriched = [{**r_, "title": "T", "company": "C"} for r_ in rec["recommendations"]]
    gap = c.post("/skill-gap", json={"recommendations": enriched}).json()
    assert gap["total_jobs"] == 2 and any(s["skill"] == "AWS" for s in gap["skills"])

    # streaming chat with a fake LLM
    def fake_stream(prompt, system, temperature=0.2):
        assert "RESUME EXCERPTS" in prompt and "SKILL GAP" in prompt and "ATS RESUME SCORE" in prompt
        for t in ["- **AWS** is ", "your top gap [J1]."]:
            yield t

    old = llm.stream_text
    llm.stream_text = fake_stream
    try:
        r = c.post("/chat/stream", json={"user_id": 7, "query": "What should I learn first?", "history": [],
                                         "profile": body["profile"], "recommendations": enriched, "ats": body["ats"]})
    finally:
        llm.stream_text = old
    events = [json.loads(l[6:]) for l in r.text.split("\n\n") if l.startswith("data: ")]
    types = [e["type"] for e in events]
    assert types[0] == "sources" and types[-1] == "done" and types.count("token") == 2, types
    assert any(s["type"] == "resume" for s in events[0]["sources"])

    # no Gemini key -> deterministic fallback answer still streams
    r = c.post("/chat/stream", json={"user_id": 7, "query": "hi", "history": [], "profile": body["profile"], "recommendations": enriched})
    text = "".join(json.loads(l[6:]).get("text", "") for l in r.text.split("\n\n") if l.startswith("data: "))
    assert "Skills to learn first" in text


if __name__ == "__main__":
    failures = 0
    for name, fn in list(globals().items()):
        if name.startswith("test_") and callable(fn):
            try:
                fn()
                print(f"PASS {name}")
            except Exception as e:  # noqa: BLE001
                failures += 1
                import traceback
                print(f"FAIL {name}: {e}")
                traceback.print_exc()
    sys.exit(1 if failures else 0)
