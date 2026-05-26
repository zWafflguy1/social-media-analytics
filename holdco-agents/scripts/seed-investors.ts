import { db, now } from '../shared/db/client.js';
import { readFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

// Two modes:
//   1. If data/investors.csv exists, import from CSV (preferred).
//   2. Otherwise, seed a handful of placeholder records so the matcher has SOMETHING to test
//      against. Replace these with real prospects from your network before going live.

const CSV_PATH = resolve('./data/investors.csv');

const PLACEHOLDERS = [
  {
    name: '[REPLACE ME] Family Office Example',
    type: 'family-office',
    focus_sectors: 'b2b-services,distribution,specialty-trades',
    check_size_min: 500_000,
    check_size_max: 3_000_000,
    geography: 'US-Southeast,US-Texas',
    thesis: 'Cash-flowing absentee-run businesses, 5-7yr hold, prefer recurring revenue.',
    contact_name: '',
    contact_email: '',
    contact_url: '',
    source_url: '',
    notes: 'Placeholder. Add real investors via CSV or dashboard.',
  },
  {
    name: '[REPLACE ME] Search Fund Sponsor Example',
    type: 'search-fund',
    focus_sectors: 'route-distribution,specialty-manufacturing,healthcare-services',
    check_size_min: 1_000_000,
    check_size_max: 5_000_000,
    geography: 'US',
    thesis: 'Control buyouts $3M-$15M EV, owner-operator transitioning to absentee CEO.',
    contact_name: '',
    contact_email: '',
    contact_url: '',
    source_url: '',
    notes: 'Placeholder.',
  },
];

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = parseLine(lines[0]).map((h) => h.trim().toLowerCase());
  return lines.slice(1).map((l) => {
    const cells = parseLine(l);
    const row: Record<string, string> = {};
    headers.forEach((h, i) => { row[h] = (cells[i] ?? '').trim(); });
    return row;
  });
}

function parseLine(line: string): string[] {
  const out: string[] = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"' && line[i + 1] === '"') { cur += '"'; i++; continue; }
    if (c === '"') { inQ = !inQ; continue; }
    if (c === ',' && !inQ) { out.push(cur); cur = ''; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

const ins = db().prepare(`
  INSERT INTO investors
    (name, type, focus_sectors, check_size_min, check_size_max, geography, thesis,
     contact_name, contact_email, contact_url, source_url, notes, created_at)
  VALUES
    (@name, @type, @focus_sectors, @check_size_min, @check_size_max, @geography, @thesis,
     @contact_name, @contact_email, @contact_url, @source_url, @notes, @created_at)
`);

const t = now();
let count = 0;

if (existsSync(CSV_PATH)) {
  const rows = parseCsv(readFileSync(CSV_PATH, 'utf8'));
  for (const r of rows) {
    if (!r.name) continue;
    ins.run({
      name: r.name,
      type: r.type || null,
      focus_sectors: r.focus_sectors || r.sectors || null,
      check_size_min: r.check_size_min ? Math.round(Number(r.check_size_min) * 100) : null,
      check_size_max: r.check_size_max ? Math.round(Number(r.check_size_max) * 100) : null,
      geography: r.geography || null,
      thesis: r.thesis || null,
      contact_name: r.contact_name || null,
      contact_email: r.contact_email || r.email || null,
      contact_url: r.contact_url || null,
      source_url: r.source_url || null,
      notes: r.notes || null,
      created_at: t,
    });
    count += 1;
  }
  console.log(`Imported ${count} investors from ${CSV_PATH}.`);
} else {
  for (const p of PLACEHOLDERS) {
    ins.run({
      ...p,
      check_size_min: p.check_size_min * 100,
      check_size_max: p.check_size_max * 100,
      created_at: t,
    });
    count += 1;
  }
  console.log(`Seeded ${count} placeholder investors. Drop a CSV at ${CSV_PATH} to import real ones.`);
  console.log(`CSV columns: name,type,focus_sectors,check_size_min,check_size_max,geography,thesis,contact_name,contact_email,contact_url,source_url,notes`);
}
