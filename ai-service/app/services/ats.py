"""Rule-based ATS (applicant tracking system) readiness score, 0-100."""
import re

from app.services.skills_vocab import find_skills

SECTION_PATTERNS = {
    "summary": r"\b(summary|objective|profile|about me)\b",
    "education": r"\b(education|academic)",
    "experience": r"\b(experience|internships?|work history|employment)\b",
    "skills": r"\b(skills|technologies|tech stack)\b",
    "projects": r"\bprojects?\b",
}
ACTION_VERBS = set("""achieved analyzed analysed architected automated built collaborated configured created
delivered deployed designed developed devised drove enabled engineered enhanced established evaluated executed
fine-tuned implemented improved increased integrated launched led maintained managed migrated mentored modeled
optimized orchestrated organized owned planned prepared presented reduced refactored researched resolved
scaled shipped simplified solved spearheaded streamlined supported tested trained transformed wrote
coordinated conducted contributed demonstrated generated identified initiated introduced published""".split())
EMAIL_RE = re.compile(r"[\w.+-]+@[\w-]+\.[\w.-]+")
PHONE_RE = re.compile(r"(?:\+?\d{1,3}[\s-]?)?(?:\d[\s-]?){9,11}\d")
YEAR_RE = re.compile(r"^(19|20)\d{2}$")


def _has_section(lines: list[str], pattern: str) -> bool:
    return any(len(l) <= 40 and re.search(pattern, l, re.IGNORECASE) for l in lines)


def _metric_lines(lines: list[str]) -> int:
    count = 0
    for l in lines:
        if len(l.split()) < 6:
            continue
        nums = re.findall(r"\d+(?:\.\d+)?%?", l)
        if any(("%" in n) or not YEAR_RE.match(n) for n in nums):
            count += 1
    return count


def score_resume(raw_text: str, profile: dict | None = None) -> dict:
    lines = [l.strip() for l in raw_text.splitlines() if l.strip()]
    words = raw_text.split()
    breakdown, suggestions = [], []

    def add(key, label, score, mx, detail):
        breakdown.append({"key": key, "label": label, "score": round(score), "max": mx, "detail": detail})

    # 1. Contact details (10)
    has_email = bool(EMAIL_RE.search(raw_text))
    has_phone = bool(PHONE_RE.search(raw_text))
    has_linkedin = "linkedin.com" in raw_text.lower()
    has_github = "github.com" in raw_text.lower()
    contact = 4 * has_email + 3 * has_phone + 2 * has_linkedin + 1 * has_github
    missing = [n for n, ok in [("email", has_email), ("phone", has_phone), ("LinkedIn", has_linkedin), ("GitHub", has_github)] if not ok]
    add("contact", "Contact details", contact, 10, "All present" if not missing else "Missing: " + ", ".join(missing))
    if not has_linkedin:
        suggestions.append("Add your LinkedIn profile link in the header.")
    if not has_email or not has_phone:
        suggestions.append("Make sure your email and phone number are in plain text at the top.")

    # 2. Standard sections (20)
    found = {k: _has_section(lines, p) for k, p in SECTION_PATTERNS.items()}
    add("sections", "Standard sections", 4 * sum(found.values()), 20,
        f"{sum(found.values())} of 5 found (summary, education, experience, skills, projects)")
    for k, ok in found.items():
        if not ok:
            suggestions.append(f"Add a clearly titled \"{k.capitalize()}\" section; ATS parsers look for standard headings.")

    # 3. Skills & keywords (20)
    n_skills = len(profile.get("skills", [])) if profile else len(find_skills(raw_text))
    add("keywords", "Skills & keywords", min(n_skills / 12, 1) * 20, 20, f"{n_skills} distinct skills detected (aim for 12 or more)")
    if n_skills < 12:
        suggestions.append("List more relevant tools and technologies; match the keywords used in the job descriptions you target.")

    # 4. Quantified impact (15)
    metrics = _metric_lines(lines)
    add("impact", "Quantified impact", min(metrics / 5, 1) * 15, 15, f"{metrics} bullet points contain numbers or percentages (aim for 5 or more)")
    if metrics < 5:
        suggestions.append("Quantify results, for example \"cut query time by 40%\" or \"served 2,000 users\".")

    # 5. Action verbs (15)
    verb_lines = 0
    for l in lines:
        if len(l.split()) < 6:
            continue
        first = re.sub(r"^[\W_]+", "", l).split(" ")[0].lower().strip(".,:;")
        if first in ACTION_VERBS:
            verb_lines += 1
    add("verbs", "Action verbs", min(verb_lines / 8, 1) * 15, 15, f"{verb_lines} bullets start with a strong action verb (aim for 8 or more)")
    if verb_lines < 8:
        suggestions.append("Start bullet points with action verbs such as Built, Designed, Optimized or Led.")

    # 6. Length (10)
    wc = len(words)
    length_score = 10 if 350 <= wc <= 900 else 6 if (200 <= wc < 350 or 900 < wc <= 1200) else 3
    add("length", "Length", length_score, 10, f"{wc} words (ideal 350 to 900)")
    if wc < 350:
        suggestions.append("Your resume is short; add detail on projects, internships and outcomes.")
    elif wc > 900:
        suggestions.append("Your resume is long; trim it to one or two pages of the most relevant content.")

    # 7. Parsing / formatting (10)
    fmt = 10
    odd = sum(1 for c in raw_text if ord(c) > 0x2FFF or c == "\ufffd")
    if raw_text and odd / len(raw_text) > 0.02:
        fmt -= 4
        suggestions.append("Some characters could not be read; avoid icons, images of text and unusual fonts.")
    avg_line = sum(len(l) for l in lines) / max(len(lines), 1)
    if avg_line < 18:
        fmt -= 4
        suggestions.append("Text appears broken into very short lines, often caused by tables or multi-column layouts. Use a single column.")
    add("format", "Parsing & formatting", max(fmt, 0), 10, "Text extracted cleanly" if fmt == 10 else "Layout may confuse ATS parsers")

    score = sum(b["score"] for b in breakdown)
    grade = "Excellent" if score >= 85 else "Good" if score >= 70 else "Needs work" if score >= 50 else "Poor"
    return {"score": score, "grade": grade, "breakdown": breakdown, "suggestions": suggestions[:8]}
