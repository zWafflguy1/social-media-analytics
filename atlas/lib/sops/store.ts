import { nanoid } from "nanoid";
import { query } from "../db";
import { audit } from "../audit";

export interface SOPInput {
  title: string;
  role?: string;
  steps: string[];
  rationale?: string;
  source?: "authored" | "inferred";
  confidence?: number;
  status?: "proposed" | "active" | "archived";
  evidence?: string[];
}

export async function listSOPs(tenantId: string, role?: string) {
  if (role) {
    return query(
      `SELECT * FROM sops WHERE tenant_id=$1 AND role=$2 ORDER BY updated_at DESC`,
      [tenantId, role]
    );
  }
  return query(`SELECT * FROM sops WHERE tenant_id=$1 ORDER BY updated_at DESC`, [tenantId]);
}

export async function createSOP(tenantId: string, sop: SOPInput): Promise<string> {
  const id = `sop_${nanoid(12)}`;
  await query(
    `INSERT INTO sops (id, tenant_id, title, role, steps, rationale, source, confidence, status, evidence)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
    [
      id,
      tenantId,
      sop.title,
      sop.role ?? null,
      JSON.stringify(sop.steps ?? []),
      sop.rationale ?? null,
      sop.source ?? "authored",
      sop.confidence ?? 1,
      sop.status ?? "active",
      JSON.stringify(sop.evidence ?? []),
    ]
  );
  await audit(tenantId, sop.source === "inferred" ? "agent" : "user", "sop.created", id, {
    title: sop.title,
    source: sop.source ?? "authored",
  });
  return id;
}

export async function setSOPStatus(
  tenantId: string,
  id: string,
  status: "proposed" | "active" | "archived"
): Promise<void> {
  await query(`UPDATE sops SET status=$3, updated_at=now() WHERE tenant_id=$1 AND id=$2`, [
    tenantId,
    id,
    status,
  ]);
  await audit(tenantId, "user", "sop.status_changed", id, { status });
}
