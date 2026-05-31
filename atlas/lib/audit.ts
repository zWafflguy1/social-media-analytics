import { query } from "./db";

// Append-only. Never updated, never deleted — this is the record of what Atlas did.
export async function audit(
  tenantId: string,
  actor: string,
  action: string,
  target?: string,
  detail: Record<string, unknown> = {}
): Promise<void> {
  await query(
    `INSERT INTO audit_log (tenant_id, actor, action, target, detail)
     VALUES ($1, $2, $3, $4, $5)`,
    [tenantId, actor, action, target ?? null, JSON.stringify(detail)]
  );
}
