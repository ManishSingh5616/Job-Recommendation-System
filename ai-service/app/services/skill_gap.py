"""Skill-gap analysis across the top recommended jobs. Fully data-driven (no LLM): every number comes from the jobs."""
from collections import defaultdict

from app.services.skills_vocab import normalize_skill

_PRIORITY_TEXT = {
    "High": "Required by at least half of your top matches. Learn these first.",
    "Medium": "Required by a quarter or more of your top matches.",
    "Low": "Appears in a few matches. Worth adding once the skills above are covered.",
}


def analyze_skill_gap(recommendations: list[dict]) -> dict:
    total = len(recommendations)
    jobs_for = defaultdict(list)       # skill key -> job titles needing it
    display = {}
    sole_gap = defaultdict(int)        # skill key -> jobs where it is one of at most two missing skills
    for r in recommendations:
        missing = r.get("missing_skills") or []
        for s in missing:
            key = normalize_skill(s).lower()
            display.setdefault(key, normalize_skill(s))
            jobs_for[key].append(r.get("title") or "Job")
            if len(missing) <= 2:
                sole_gap[key] += 1

    skills = []
    for key, titles in sorted(jobs_for.items(), key=lambda kv: (-len(kv[1]), kv[0])):
        pct = round(100 * len(titles) / total) if total else 0
        skills.append({"skill": display[key], "jobs_count": len(titles), "total_jobs": total, "percent": pct,
                       "priority": "High" if pct >= 50 else "Medium" if pct >= 25 else "Low",
                       "example_jobs": titles[:3]})

    roadmap = []
    for priority in ("High", "Medium", "Low"):
        group = [s for s in skills if s["priority"] == priority]
        if group:
            roadmap.append({"priority": priority, "reason": _PRIORITY_TEXT[priority], "skills": [s["skill"] for s in group[:6]]})

    quick_wins = [{"skill": display[k], "jobs_unlocked": c} for k, c in sorted(sole_gap.items(), key=lambda kv: (-kv[1], kv[0]))[:5]]
    return {"total_jobs": total, "skills": skills, "roadmap": roadmap, "quick_wins": quick_wins}
