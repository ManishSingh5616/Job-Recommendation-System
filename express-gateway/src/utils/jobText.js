/** Heuristics that turn a raw job posting into the structured fields the matcher needs. */
export function inferExperience(title, description) {
  const t = `${title} ${description}`.toLowerCase();
  let m = t.match(/(\d+)\s*(?:-|–|to)\s*(\d+)\s*\+?\s*(?:years|yrs)/);
  if (m) return `${m[1]}-${m[2]} years`;
  m = t.match(/(\d+)\s*\+\s*(?:years|yrs)/)
    || t.match(/(?:minimum|at least|min\.?)\s*(\d+)\s*(?:years|yrs)/)
    || t.match(/(\d+)\s*(?:years|yrs)\s*(?:of)?\s*(?:experience|exp)/);
  if (m) return `${m[1]}+ years`;
  if (/\b(fresher|intern(ship)?|entry[- ]level|graduate|trainee)\b/.test(t)) return '0-1 years';
  if (/\b(junior|jr\.?)\b/.test(t)) return '0-2 years';
  if (/\b(senior|sr\.?|lead|principal|architect|manager)\b/.test(t)) return '5+ years';
  return '';
}

export function inferEducation(text) {
  const t = String(text).toLowerCase();
  if (/\b(b\.?\s?tech|b\.?e\b|bachelor|b\.?\s?sc|bca)/.test(t)) return "Bachelor's Degree";
  if (/\b(m\.?\s?tech|master|m\.?\s?sc|mba|mca)/.test(t)) return "Master's Degree";
  if (/ph\.?\s?d|doctorate/.test(t)) return 'PhD';
  return '';
}

export function inferType(title, contractTime, contractType) {
  if (/\bintern(ship)?\b/i.test(title)) return 'Internship';
  if (contractTime === 'part_time') return 'Part-Time';
  if (contractType === 'contract') return 'Contract';
  return 'Full-Time';
}

export function formatSalary(min, max, predicted, country) {
  if (!min && !max) return '';
  const lo = min || max;
  const hi = max || min;
  const est = String(predicted) === '1' ? ' (est.)' : '';
  if (country === 'in') {
    const f = (n) => (n / 100000).toFixed(1);
    return lo === hi ? `₹${f(lo)} LPA${est}` : `₹${f(lo)}-${f(hi)} LPA${est}`;
  }
  const f = (n) => Math.round(n).toLocaleString('en-US');
  return lo === hi ? `${f(lo)}${est}` : `${f(lo)}-${f(hi)}${est}`;
}
