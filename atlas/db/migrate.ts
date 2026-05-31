// Applies db/schema.sql. Idempotent — every statement uses IF NOT EXISTS.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { getPool } from "../lib/db";

async function main() {
  const sql = readFileSync(join(process.cwd(), "db", "schema.sql"), "utf8");
  const pool = getPool();
  console.log("Applying schema…");
  await pool.query(sql);
  console.log("Schema applied.");
  await pool.end();
}

main().catch((err) => {
  console.error("Migration failed:", err);
  process.exit(1);
});
