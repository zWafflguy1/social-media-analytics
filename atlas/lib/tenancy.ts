import { type NextRequest } from "next/server";
import { queryOne } from "./db";

/**
 * Resolve the tenant for a request. In this foundation we trust an
 * `x-atlas-tenant` header (set by the gateway / session in production). The key
 * invariant: every data query is scoped by the returned tenantId — nothing
 * reads or writes across the tenant boundary.
 */
export async function resolveTenant(req: NextRequest): Promise<string> {
  const tenantId = req.headers.get("x-atlas-tenant");
  if (!tenantId) throw new TenantError("missing x-atlas-tenant header");
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM tenants WHERE id = $1`,
    [tenantId]
  );
  if (!row) throw new TenantError(`unknown tenant: ${tenantId}`);
  return row.id;
}

export class TenantError extends Error {}

/** Effective autonomy ceiling = min(global cap, tenant cap), unless frozen. */
export async function autonomyCeiling(tenantId: string): Promise<number> {
  if (process.env.ATLAS_ACTIONS_FROZEN === "true") return 1; // drafts only
  const globalCap = Number(process.env.ATLAS_MAX_AUTONOMY_TIER ?? 1);
  const row = await queryOne<{ max_autonomy_tier: number }>(
    `SELECT max_autonomy_tier FROM tenants WHERE id = $1`,
    [tenantId]
  );
  const tenantCap = row?.max_autonomy_tier ?? 1;
  return Math.min(globalCap, tenantCap);
}
