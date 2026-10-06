from app.services import embeddings, scoring
from app.services.vector_store import job_store


def profile_query(profile: dict) -> str:
    prefs = profile.get("preferences") or {}
    roles = [e.get("role", "") for e in profile.get("experience", [])[:3]]
    projects = [f"{p.get('name', '')} {p.get('description', '')} {' '.join(p.get('technologies', []))}" for p in profile.get("projects", [])[:4]]
    parts = [prefs.get("role", ""), " ".join(r for r in roles if r), "Skills: " + ", ".join(profile.get("skills", [])[:40]),
             " ".join(projects), " ".join(e.get("degree", "") for e in profile.get("education", [])[:2])]
    return ". ".join(p for p in parts if p.strip())[:2000]


def rank_jobs(profile: dict, top_k: int = 20) -> tuple[list[dict], int]:
    indexed = job_store.count
    if not indexed:
        return [], 0
    user_skills = profile.get("skills", [])
    degrees = [e.get("degree", "") for e in profile.get("education", [])]
    years = float(profile.get("total_years") or 0)
    prefs = profile.get("preferences") or {}

    candidates = job_store.search(embeddings.embed_query(profile_query(profile)), max(60, top_k))
    results = []
    for job in candidates:
        job_skills = job.get("skills", [])
        skill_m = scoring.compute_skill_match(user_skills, job_skills)
        sem_m = scoring.normalize_semantic(job["raw_similarity"])
        exp_m = scoring.compute_experience_match(years, job.get("experience_required", ""))
        edu_m = scoring.compute_education_match(degrees, job.get("education_required", ""))
        pref_m = scoring.compute_preference_match(prefs, job.get("location", ""), job.get("employment_type", ""), job.get("title", ""))
        results.append({
            "job_id": job["job_id"],
            "overall_score": round(scoring.calculate_compatibility(skill_m, sem_m, exp_m, edu_m, pref_m) * 100, 1),
            "breakdown": {"skill_match": round(skill_m * 100, 1), "semantic_similarity": round(sem_m * 100, 1),
                          "experience_match": round(exp_m * 100, 1), "education_match": round(edu_m * 100, 1),
                          "preference_match": round(pref_m * 100, 1)},
            "matched_skills": scoring.find_matched_skills(user_skills, job_skills),
            "missing_skills": scoring.find_missing_skills(user_skills, job_skills),
        })
    results.sort(key=lambda r: r["overall_score"], reverse=True)
    return results[:top_k], indexed
