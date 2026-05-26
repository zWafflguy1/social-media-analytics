// Auto-generated wrapper around schema.sql so the schema works in both ESM tsx runs
// and Next.js server bundles (which don't always expose import.meta.dirname).
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

function moduleDir(): string {
  if (typeof import.meta !== 'undefined') {
    if (typeof (import.meta as { dirname?: string }).dirname === 'string') {
      return (import.meta as { dirname: string }).dirname;
    }
    if (typeof import.meta.url === 'string') {
      try { return dirname(fileURLToPath(import.meta.url)); } catch { /* fall through */ }
    }
  }
  return process.cwd();          // last resort
}

let cached: string | null = null;
export function getSchemaSql(): string {
  if (cached) return cached;
  const candidates = [
    resolve(moduleDir(), 'schema.sql'),
    resolve(process.cwd(), 'shared/db/schema.sql'),
    resolve(process.cwd(), '../shared/db/schema.sql'),
  ];
  for (const p of candidates) {
    try {
      cached = readFileSync(p, 'utf8');
      return cached;
    } catch { /* try next */ }
  }
  throw new Error(`schema.sql not found. Tried: ${candidates.join(', ')}`);
}
