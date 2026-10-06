import json
import re
from functools import lru_cache

from app import config


@lru_cache(maxsize=1)
def _load():
    raw = json.loads(config.VOCAB_PATH.read_text(encoding="utf-8"))
    alias_map = {}
    for canonical, aliases in raw.items():
        alias_map[canonical.lower()] = canonical
        for alias in aliases:
            alias_map[alias.lower()] = canonical
    ordered = sorted(alias_map.keys(), key=len, reverse=True)
    pattern = re.compile(
        r"(?<![A-Za-z0-9+#.])(" + "|".join(re.escape(a) for a in ordered) + r")(?![A-Za-z0-9+#])",
        re.IGNORECASE,
    )
    return alias_map, pattern


def find_skills(text: str) -> list[str]:
    """Canonical skill names found in text, in order of first appearance."""
    alias_map, pattern = _load()
    found, seen = [], set()
    for m in pattern.finditer(text or ""):
        canonical = alias_map.get(m.group(1).lower())
        if canonical and canonical not in seen:
            seen.add(canonical)
            found.append(canonical)
    return found


def normalize_skill(name: str) -> str:
    name = (name or "").strip()
    alias_map, _ = _load()
    return alias_map.get(name.lower(), name)
