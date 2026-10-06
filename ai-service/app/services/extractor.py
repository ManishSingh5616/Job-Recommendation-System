"""Resume -> structured profile using the WHOLE resume.

1. The text is split into overlapping chunks that fit comfortably in the LLM context.
2. EVERY chunk is sent to Gemini (3 in parallel) and the partial results are merged deterministically.
3. One consolidation call lets the LLM remove duplicates from the merged result.
If Gemini is unreachable, a local keyword fallback returns only what it can actually find (nothing is invented)."""
import json
import re
from concurrent.futures import ThreadPoolExecutor

from app.services import llm
from app.services.skills_vocab import find_skills, normalize_skill

CHUNK_PROMPT = """You are extracting structured data from part {i} of {n} of a resume.
Extract ONLY what is present in this part. Use empty strings or empty lists for anything absent. Never invent information.
Return JSON in exactly this shape:
{
  "name": "", "email": "", "phone": "",
  "education": [{"degree": "", "institution": "", "year": ""}],
  "skills": [],
  "experience": [{"role": "", "company": "", "duration": "", "years": 0.0}],
  "projects": [{"name": "", "description": "", "technologies": []}],
  "certifications": [],
  "preferences": {"role": "", "location": "", "employment_type": ""}
}
"years" is the length of that role in years as a number (6 months = 0.5, unknown = 0).
"preferences" only if the resume states a career objective, preferred role or location.
Resume part:
"""

CONSOLIDATE_PROMPT = """Below is structured resume data merged from several parts of one resume.
Remove duplicates, merge entries that describe the same education, role or project, and fix obviously wrong fields.
Keep everything else. Do not add anything that is not in the input. Return JSON in the same shape.
Input:
"""

EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,11}\d")
DEGREE_START_RE = re.compile(
    r"^(B\.?\s?Tech|M\.?\s?Tech|B\.?\s?E\b|M\.?\s?E\b|B\.?\s?Sc|M\.?\s?Sc|BCA|MCA|MBA|Bachelor|Master|Ph\.?D|Diploma)", re.IGNORECASE)
YEAR_RE = re.compile(r"(?:19|20)\d{2}")


def chunk_text(text: str, max_chars: int = 3500, overlap: int = 250) -> list[str]:
    text = text.strip()
    if len(text) <= max_chars:
        return [text]
    chunks, current = [], ""
    for line in text.splitlines():
        if current and len(current) + len(line) + 1 > max_chars:
            chunks.append(current)
            tail = current[-overlap:]
            current = tail[tail.index("\n") + 1:] if "\n" in tail else tail  # overlap starts at a line boundary
        current += line + "\n"
    if current.strip():
        chunks.append(current)
    return chunks


def _s(value) -> str:
    return str(value).strip() if value is not None else ""


def _f(value) -> float:
    try:
        return max(0.0, float(value))
    except (TypeError, ValueError):
        return 0.0


def _list(value) -> list:
    return value if isinstance(value, list) else []


def merge_parts(parts: list[dict]) -> dict:
    out = {"name": "", "email": "", "phone": "", "education": [], "skills": [], "experience": [], "projects": [],
           "certifications": [], "preferences": {"role": "", "location": "", "employment_type": ""}}
    seen = {"edu": set(), "skill": set(), "exp": set(), "proj": set(), "cert": set()}
    for p in parts:
        if not isinstance(p, dict):
            continue
        for key in ("name", "email", "phone"):
            if not out[key] and _s(p.get(key)):
                out[key] = _s(p[key])
        for e in _list(p.get("education")):
            if isinstance(e, dict):
                item = {"degree": _s(e.get("degree")), "institution": _s(e.get("institution")), "year": _s(e.get("year"))}
                key = (item["degree"].lower(), item["institution"].lower())
                if (item["degree"] or item["institution"]) and key not in seen["edu"]:
                    seen["edu"].add(key)
                    out["education"].append(item)
        for s in _list(p.get("skills")):
            s = normalize_skill(_s(s))
            if s and s.lower() not in seen["skill"]:
                seen["skill"].add(s.lower())
                out["skills"].append(s)
        for e in _list(p.get("experience")):
            if isinstance(e, dict):
                item = {"role": _s(e.get("role")), "company": _s(e.get("company")),
                        "duration": _s(e.get("duration")), "years": _f(e.get("years"))}
                key = (item["role"].lower(), item["company"].lower())
                if (item["role"] or item["company"]) and key not in seen["exp"]:
                    seen["exp"].add(key)
                    out["experience"].append(item)
        for pr in _list(p.get("projects")):
            if isinstance(pr, dict) and _s(pr.get("name")) and _s(pr["name"]).lower() not in seen["proj"]:
                seen["proj"].add(_s(pr["name"]).lower())
                tech = pr.get("technologies") or pr.get("tech") or []
                out["projects"].append({"name": _s(pr["name"]), "description": _s(pr.get("description")),
                                        "technologies": [_s(t) for t in _list(tech) if _s(t)]})
        for c in _list(p.get("certifications")):
            c = _s(c)
            if c and c.lower() not in seen["cert"]:
                seen["cert"].add(c.lower())
                out["certifications"].append(c)
        prefs = p.get("preferences")
        if isinstance(prefs, dict):
            for k in out["preferences"]:
                if not out["preferences"][k] and _s(prefs.get(k)):
                    out["preferences"][k] = _s(prefs[k])
    out["total_years"] = round(sum(e["years"] for e in out["experience"]), 1)
    return out


def _guess_name(raw_text: str) -> str:
    for line in [l.strip() for l in raw_text.splitlines() if l.strip()][:6]:
        if "@" not in line and not re.search(r"\d{5,}", line) and len(line) < 50 and len(line.split()) <= 5:
            return line
    return ""


def _fill_contacts(profile: dict, raw_text: str) -> dict:
    if not profile["email"] and (m := EMAIL_RE.search(raw_text)):
        profile["email"] = m.group(0)
    if not profile["phone"] and (m := PHONE_RE.search(raw_text)):
        profile["phone"] = m.group(0).strip()
    if not profile["name"]:
        profile["name"] = _guess_name(raw_text)
    return profile


def local_extract(raw_text: str) -> dict:
    education, seen = [], set()
    for line in (l.strip(" -•*\t") for l in raw_text.splitlines()):
        if DEGREE_START_RE.match(line) and len(line) < 160 and line.lower() not in seen:
            seen.add(line.lower())
            parts = [p.strip() for p in line.split(",")]
            year = YEAR_RE.search(line)
            education.append({"degree": parts[0], "institution": parts[1] if len(parts) > 1 and not YEAR_RE.fullmatch(parts[1]) else "",
                              "year": year.group(0) if year else ""})
    profile = merge_parts([{"education": education[:3], "skills": find_skills(raw_text)}])
    return _fill_contacts(profile, raw_text)


def extract_profile(raw_text: str) -> tuple[dict, dict]:
    chunks = chunk_text(raw_text)
    n = len(chunks)

    def run(args):
        i, chunk = args
        try:
            return llm.generate_json(CHUNK_PROMPT.replace("{i}", str(i)).replace("{n}", str(n)) + chunk)
        except Exception as exc:
            print(f"[extractor] chunk {i}/{n} failed: {exc}")
            return None

    with ThreadPoolExecutor(max_workers=3) as pool:
        results = list(pool.map(run, enumerate(chunks, start=1)))
    good = [r for r in results if isinstance(r, dict)]
    meta = {"chunks": n, "chunks_failed": n - len(good)}

    if not good:
        return local_extract(raw_text), {**meta, "mode": "fallback"}

    merged = merge_parts(good)
    profile = merged
    try:  # let the LLM clean duplicates, but never let it silently drop most of the data
        cleaned = llm.generate_json(CONSOLIDATE_PROMPT + json.dumps(merged, ensure_ascii=False))
        if isinstance(cleaned, dict):
            candidate = merge_parts([cleaned])
            if len(candidate["skills"]) >= 0.7 * len(merged["skills"]) and len(candidate["experience"]) >= 0.5 * len(merged["experience"]):
                profile = candidate
    except Exception as exc:
        print(f"[extractor] consolidation skipped: {exc}")

    if not profile["skills"]:
        profile["skills"] = find_skills(raw_text)
    return _fill_contacts(profile, raw_text), {**meta, "mode": "llm"}
