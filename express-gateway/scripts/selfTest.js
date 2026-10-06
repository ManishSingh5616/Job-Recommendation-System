/** Offline checks for the parts that do not need PostgreSQL or the AI service: node scripts/selfTest.js */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCSV, toCSV } from '../src/utils/csv.js';
import { inferEducation, inferExperience, formatSalary, inferType } from '../src/utils/jobText.js';
import { findSkills, normalizeSkill } from '../src/utils/skillsVocab.js';

const here = path.dirname(fileURLToPath(import.meta.url));

const cols = ['a', 'b', 'c'];
const rows = [{ a: 'plain', b: 'has, comma', c: 'multi\nline "quoted"' }, { a: '', b: 'x', c: '' }];
assert.deepEqual(parseCSV(toCSV(rows, cols)), rows, 'CSV round trip');

const fallback = parseCSV(fs.readFileSync(path.join(here, '../data/jobs_fallback.csv'), 'utf8'));
assert.equal(fallback.length, 3);
for (const r of fallback) {
  assert.ok(r.skills.split('|').length >= 6 && r.description.length > 300 && r.external_id, r.title);
  const detected = findSkills(r.description);
  const listed = r.skills.split('|');
  const overlap = listed.filter((s) => detected.includes(s)).length;
  assert.ok(overlap >= 4, `${r.title}: description should mention most listed skills (${overlap})`);
}

assert.deepEqual(findSkills('Node.js, C++, ReactJS and postgres; not javascripty').sort(), ['C++', 'Node.js', 'PostgreSQL', 'React'].sort());
assert.equal(normalizeSkill('k8s'), 'Kubernetes');
assert.equal(inferExperience('Engineer', 'Requires 2-4 years of experience'), '2-4 years');
assert.equal(inferExperience('Senior Developer', ''), '5+ years');
assert.equal(inferExperience('Software Intern', ''), '0-1 years');
assert.equal(inferEducation('B.Tech or equivalent'), "Bachelor's Degree");
assert.equal(inferType('ML Intern', 'full_time'), 'Internship');
assert.equal(formatSalary(800000, 1200000, '0', 'in'), '₹8.0-12.0 LPA');
console.log('Gateway self-test passed.');
