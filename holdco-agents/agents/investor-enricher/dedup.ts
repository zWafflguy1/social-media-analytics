const SUFFIX_TOKENS = new Set([
  'llc', 'l.l.c.', 'inc', 'inc.', 'corp', 'corp.', 'corporation',
  'lp', 'l.p.', 'llp', 'l.l.p.', 'plc', 'limited', 'ltd', 'ltd.',
  'co', 'co.', 'company',
  'fund', 'funds', 'iii', 'iv', 'ii', 'v', 'vi', 'vii',
  'i', 'ix', 'x',
]);

// Returns a normalized comparison key. Removes legal suffixes, lowercases,
// strips punctuation and roman-numeral fund-vintage tokens. Best-effort —
// "Acme Capital Fund II" and "Acme Capital" will collide.
export function normalizeName(raw: string): string {
  const tokens = raw
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .filter((t) => !SUFFIX_TOKENS.has(t));
  return tokens.join(' ');
}
