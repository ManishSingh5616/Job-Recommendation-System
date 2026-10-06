"""Retrieval-Augmented Generation over the candidate's own data.

* index_resume(): at upload time the resume is split into chunks, embedded and stored per user (disk + memory).
* stream_answer(): the question is embedded, the most similar resume chunks are retrieved, and they are combined with
  the profile, top job matches, skill-gap analysis and ATS report. Gemini answers from that context only and the reply
  is streamed to the browser as Server-Sent Events:  sources -> token ... -> done.
  If Gemini is unavailable, a deterministic answer built from the same data is streamed instead."""
import json

import numpy as np

from app import config
from app.services import embeddings, llm
from app.services.extractor import chunk_text
from app.services.skill_gap import analyze_skill_gap

SYSTEM = """You are the Career Assistant inside a job-matching app for students and early-career candidates.
Answer using ONLY the context provided: resume excerpts [R#], top job matches [J#], skill gap analysis and the ATS resume score.
If the context does not contain the answer, say what is missing, then give brief guidance clearly labelled "General advice".
Formatting rules (always Markdown):
- Begin with a one-line direct answer.
- Then use short bullet points ("- ") with **bold** for key skills, roles, companies and numbers.
- Use a short ### heading only when the answer has distinct sections.
- Cite sources sparingly in square brackets, for example [J2] or [R1].
- Be concise and actionable. Never invent jobs, companies, scores or skills that are not in the context."""

_resume_cache: dict[int, tuple[list[str], np.ndarray]] = {}


def _paths(user_id: int):
    d = config.FAISS_DIR / "resumes"
    d.mkdir(parents=True, exist_ok=True)
    return d / f"user_{int(user_id)}.json", d / f"user_{int(user_id)}.npy"


def index_resume(user_id: int, raw_text: str) -> int:
    chunks = [c.strip() for c in chunk_text(raw_text[:14000], 700, 100) if c.strip()]
    if not chunks:
        return 0
    vectors = np.asarray(embeddings.embed_passages(chunks), dtype="float32")
    meta_path, vec_path = _paths(user_id)
    meta_path.write_text(json.dumps(chunks, ensure_ascii=False), encoding="utf-8")
    np.save(vec_path, vectors)
    _resume_cache[int(user_id)] = (chunks, vectors)
    return len(chunks)


def _load_resume(user_id: int):
    uid = int(user_id)
    if uid in _resume_cache:
        return _resume_cache[uid]
    meta_path, vec_path = _paths(uid)
    if meta_path.exists() and vec_path.exists():
        _resume_cache[uid] = (json.loads(meta_path.read_text(encoding="utf-8")), np.load(vec_path))
        return _resume_cache[uid]
    return [], np.zeros((0, 1), dtype="float32")


def _retrieve_resume(user_id: int, query: str, k: int = 4) -> list[str]:
    chunks, vectors = _load_resume(user_id)
    if not chunks:
        return []
    sims = vectors @ embeddings.embed_query(query)
    return [chunks[int(i)] for i in np.argsort(-sims)[:k]]


def _sse(obj: dict) -> str:
    return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n"


def _profile_text(p: dict) -> str:
    edu = "; ".join(f"{e.get('degree', '')} {e.get('institution', '')} {e.get('year', '')}".strip() for e in p.get("education", []))
    exp = "; ".join(f"{e.get('role', '')} at {e.get('company', '')} ({e.get('duration', '')})" for e in p.get("experience", []))
    proj = "; ".join(x.get("name", "") for x in p.get("projects", []))
    return (f"Name: {p.get('name', '')}. Skills: {', '.join(p.get('skills', []))}. Education: {edu or 'n/a'}. "
            f"Experience: {exp or 'none listed'} ({p.get('total_years', 0)} years). Projects: {proj or 'none listed'}.")


def _fallback_answer(recs: list[dict], ats: dict | None) -> str:
    gap = analyze_skill_gap(recs)
    lines = ["The AI model is not reachable right now, so here is a summary computed directly from your data.", "", "### Skills to learn first"]
    if gap["skills"]:
        lines += [f"- **{s['skill']}**: needed by {s['jobs_count']} of {s['total_jobs']} top matches ({s['percent']}%, {s['priority']} priority)"
                  for s in gap["skills"][:5]]
    else:
        lines.append("- No skill gaps found across your top matches.")
    if recs:
        lines += ["", "### Best matches"] + [f"- **{r.get('title', 'Job')}** at {r.get('company', '')}: {r.get('overall_score', 0)}% match" for r in recs[:3]]
    if ats:
        lines += ["", "### Resume (ATS) score", f"- **{ats.get('score')}/100** ({ats.get('grade', '')})"]
        lines += [f"- {s}" for s in (ats.get("suggestions") or [])[:2]]
    return "\n".join(lines)


def stream_answer(user_id: int, query: str, history: list[dict], profile: dict, recs: list[dict], ats: dict | None):
    try:
        excerpts = _retrieve_resume(user_id, query)
    except Exception as exc:  # embedding model not available: continue with the other context
        print(f"[rag] resume retrieval failed: {exc}")
        excerpts = []
    top = sorted(recs, key=lambda r: r.get("overall_score", 0), reverse=True)[:8]
    gap = analyze_skill_gap(recs)

    sources = [{"type": "resume", "label": f"Resume excerpt {i}", "snippet": e[:160]} for i, e in enumerate(excerpts, 1)]
    sources += [{"type": "job", "job_id": r.get("job_id"), "title": r.get("title", ""), "company": r.get("company", "")} for r in top[:5]]
    if gap["skills"]:
        sources.append({"type": "skill_gap", "label": "Skill gap analysis"})
    if ats:
        sources.append({"type": "ats", "label": "ATS resume score"})
    yield _sse({"type": "sources", "sources": sources})

    resume_block = "\n".join(f"[R{i}] {e}" for i, e in enumerate(excerpts, 1)) or "(no resume excerpts indexed)"
    jobs_block = "\n".join(
        f"[J{i}] {r.get('title')} at {r.get('company')}: {r.get('overall_score')}% match. Has: {', '.join(r.get('matched_skills', [])) or 'none'}. "
        f"Missing: {', '.join(r.get('missing_skills', [])) or 'none'}." for i, r in enumerate(top, 1)) or "(no job matches yet)"
    gap_block = "\n".join(f"- {s['skill']}: {s['jobs_count']} of {s['total_jobs']} jobs ({s['percent']}%, {s['priority']})" for s in gap["skills"][:12]) or "(none)"
    if ats:
        weak = "; ".join(f"{b['label']} {b['score']}/{b['max']} ({b['detail']})" for b in ats.get("breakdown", []) if b["score"] < b["max"])
        ats_block = f"{ats.get('score')}/100 ({ats.get('grade')}). Weak areas: {weak or 'none'}. Suggestions: {' '.join(ats.get('suggestions', []))}"
    else:
        ats_block = "not available"
    convo = "\n".join(f"{'User' if h.get('role') == 'user' else 'Assistant'}: {str(h.get('content', ''))[:600]}" for h in (history or [])[-6:])

    prompt = (f"CANDIDATE PROFILE:\n{_profile_text(profile)}\n\nRESUME EXCERPTS:\n{resume_block}\n\nTOP JOB MATCHES:\n{jobs_block}\n\n"
              f"SKILL GAP ANALYSIS:\n{gap_block}\n\nATS RESUME SCORE: {ats_block}\n\n"
              f"CONVERSATION SO FAR:\n{convo or '(none)'}\n\nUSER QUESTION: {query}\n\nAnswer in Markdown following the rules.")

    produced = False
    try:
        for piece in llm.stream_text(prompt, SYSTEM, temperature=0.2):
            produced = True
            yield _sse({"type": "token", "text": piece})
    except Exception as exc:
        print(f"[rag] generation failed: {exc}")
        if not produced:
            for line in _fallback_answer(recs, ats).split("\n"):
                yield _sse({"type": "token", "text": line + "\n"})
    yield _sse({"type": "done"})
