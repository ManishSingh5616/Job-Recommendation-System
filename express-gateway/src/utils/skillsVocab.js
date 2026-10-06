import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const vocabPath = process.env.SKILLS_VOCAB_PATH || path.resolve(here, '../../../shared/skills_vocab.json');
const raw = JSON.parse(fs.readFileSync(vocabPath, 'utf8'));

const aliasMap = new Map();
for (const [canonical, aliases] of Object.entries(raw)) {
  aliasMap.set(canonical.toLowerCase(), canonical);
  for (const a of aliases) aliasMap.set(a.toLowerCase(), canonical);
}
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const ordered = [...aliasMap.keys()].sort((a, b) => b.length - a.length);
const pattern = new RegExp(`(?<![A-Za-z0-9+#.])(${ordered.map(escapeRe).join('|')})(?![A-Za-z0-9+#])`, 'gi');

/** Canonical skill names found in the text, in order of first appearance. */
export function findSkills(text) {
  const found = [];
  const seen = new Set();
  for (const m of String(text || '').matchAll(pattern)) {
    const canonical = aliasMap.get(m[1].toLowerCase());
    if (canonical && !seen.has(canonical)) { seen.add(canonical); found.push(canonical); }
  }
  return found;
}

export const normalizeSkill = (name) => aliasMap.get(String(name || '').trim().toLowerCase()) || String(name || '').trim();
