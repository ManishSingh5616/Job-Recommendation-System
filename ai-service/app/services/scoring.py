"""Rule-based weighted compatibility scoring (weights from the project synopsis)."""
import re

from app import config
from app.services.skills_vocab import normalize_skill

WEIGHTS = {"skill": 0.35, "semantic": 0.25, "experience": 0.15, "education": 0.15, "preference": 0.10}


def normalize_semantic(raw: float) -> float:
    return max(0.0, min(1.0, (raw - config.SEM_FLOOR) / (config.SEM_CEIL - config.SEM_FLOOR)))


def _keys(skills) -> set:
    return {normalize_skill(s).lower() for s in skills if s and str(s).strip()}


def compute_skill_match(user_skills, job_skills) -> float:
    j = _keys(job_skills)
    if not j:
        return 0.5  # job lists no skills: neutral
    return len(_keys(user_skills) & j) / len(j)


def find_missing_skills(user_skills, job_skills) -> list[str]:
    u = _keys(user_skills)
    return [s for s in job_skills if normalize_skill(s).lower() not in u]


def find_matched_skills(user_skills, job_skills) -> list[str]:
    u = _keys(user_skills)
    return [s for s in job_skills if normalize_skill(s).lower() in u]


def parse_min_years(exp_str):
    if not exp_str:
        return None
    s = exp_str.lower()
    if re.search(r"fresher|entry|no experience", s):
        return 0.0
    m = re.search(r"(\d+(?:\.\d+)?)\s*(?:-|–|to)\s*(\d+(?:\.\d+)?)", s) or re.search(r"(\d+(?:\.\d+)?)\s*\+", s) or re.search(r"(\d+(?:\.\d+)?)", s)
    return float(m.group(1)) if m else None


def compute_experience_match(user_years: float, exp_str: str) -> float:
    req = parse_min_years(exp_str)
    if req is None or req <= 0 or user_years >= req:
        return 1.0
    return max(0.2, user_years / req)


_LEVELS = [
    (4, r"ph\.?\s?d|doctorate"),
    (3, r"post\s?graduate|\bmaster|\bm\.?\s?tech|\bm\.?\s?e\b|\bm\.?\s?sc|\bmca\b|\bmba\b|\bm\.?\s?s\b"),
    (2, r"bachelor|\bb\.?\s?tech|\bb\.?\s?e\b|\bb\.?\s?sc|\bbca\b|\bb\.?\s?s\b|\bb\.?\s?com|graduate|degree"),
    (1, r"diploma|polytechnic"),
]


def education_level(text: str):
    t = (text or "").lower()
    for level, pattern in _LEVELS:
        if re.search(pattern, t):
            return level
    return None


def compute_education_match(user_degrees: list, job_edu: str) -> float:
    required = education_level(job_edu)
    if required is None:
        return 1.0
    levels = [l for l in (education_level(d) for d in user_degrees) if l]
    if not levels:
        return 0.6
    gap = required - max(levels)
    return 1.0 if gap <= 0 else 0.6 if gap == 1 else 0.3


def compute_preference_match(pref: dict, job_loc: str, job_type: str, job_title: str = "") -> float:
    pref = pref or {}
    checks = []
    loc = (pref.get("location") or "").lower().strip()
    if loc:
        jl = (job_loc or "").lower()
        checks.append(1.0 if (loc in jl or "remote" in jl) else 0.0)
    emp = (pref.get("employment_type") or "").lower().replace("-", " ").strip()
    if emp:
        checks.append(1.0 if emp in (job_type or "").lower().replace("-", " ") else 0.0)
    tokens = [t for t in re.findall(r"[a-z+#.]+", (pref.get("role") or "").lower()) if len(t) > 3]
    if tokens and job_title:
        checks.append(1.0 if any(t in job_title.lower() for t in tokens) else 0.0)
    return sum(checks) / len(checks) if checks else 0.5


def calculate_compatibility(skill_m, sem_m, exp_m, edu_m, pref_m) -> float:
    return round(WEIGHTS["skill"] * skill_m + WEIGHTS["semantic"] * sem_m + WEIGHTS["experience"] * exp_m
                 + WEIGHTS["education"] * edu_m + WEIGHTS["preference"] * pref_m, 4)
