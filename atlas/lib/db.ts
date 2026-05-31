import { Pool, type PoolClient } from "pg";
import pgvector from "pgvector/pg";

// Single shared pool across the serverless lifetime.
let pool: Pool | null = null;

export function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL is not set");
    }
    pool = new Pool({ connectionString, max: 8 });
    // Register pgvector type parsing on every fresh connection.
    pool.on("connect", (client) => {
      pgvector.registerType(client).catch(() => {
        /* extension may not be ready during migrate; ignore */
      });
    });
  }
  return pool;
}

export async function query<T = any>(
  text: string,
  params: any[] = []
): Promise<T[]> {
  const res = await getPool().query(text, params);
  return res.rows as T[];
}

export async function queryOne<T = any>(
  text: string,
  params: any[] = []
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

// Run a set of statements inside a transaction.
export async function withTx<T>(
  fn: (client: PoolClient) => Promise<T>
): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
}
