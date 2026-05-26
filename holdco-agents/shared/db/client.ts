import Database from 'better-sqlite3';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import 'dotenv/config';

const DB_PATH = process.env.DB_PATH ?? './data/holdco.db';
const SCHEMA_PATH = resolve(import.meta.dirname, 'schema.sql');

let _db: Database.Database | null = null;

export function db(): Database.Database {
  if (_db) return _db;
  const absPath = resolve(DB_PATH);
  mkdirSync(dirname(absPath), { recursive: true });
  const fresh = !existsSync(absPath);
  _db = new Database(absPath);
  _db.pragma('journal_mode = WAL');
  _db.pragma('foreign_keys = ON');
  if (fresh) {
    const schema = readFileSync(SCHEMA_PATH, 'utf8');
    _db.exec(schema);
  }
  return _db;
}

export function now(): number {
  return Math.floor(Date.now() / 1000);
}

export function closeDb(): void {
  if (_db) {
    _db.close();
    _db = null;
  }
}
