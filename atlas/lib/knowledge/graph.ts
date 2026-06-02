import { nanoid } from "nanoid";
import { query, queryOne } from "../db";

// Upsert an entity, returning its id. Entities are unique per (tenant, kind, name).
export async function upsertEntity(
  tenantId: string,
  kind: string,
  name: string,
  attrs: Record<string, unknown> = {}
): Promise<string> {
  const existing = await queryOne<{ id: string }>(
    `SELECT id FROM entities WHERE tenant_id=$1 AND kind=$2 AND name=$3`,
    [tenantId, kind, name]
  );
  if (existing) return existing.id;
  const id = `ent_${nanoid(12)}`;
  await query(
    `INSERT INTO entities (id, tenant_id, kind, name, attrs)
     VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT (tenant_id, kind, name) DO NOTHING`,
    [id, tenantId, kind, name, JSON.stringify(attrs)]
  );
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM entities WHERE tenant_id=$1 AND kind=$2 AND name=$3`,
    [tenantId, kind, name]
  );
  return row!.id;
}

export async function addRelation(
  tenantId: string,
  srcId: string,
  predicate: string,
  dstId: string,
  eventId?: string
): Promise<void> {
  await query(
    `INSERT INTO relations (tenant_id, src_id, predicate, dst_id, event_id)
     VALUES ($1,$2,$3,$4,$5)`,
    [tenantId, srcId, predicate, dstId, eventId ?? null]
  );
}

// Neighborhood of an entity — used to give the agent graph context.
export async function neighborhood(tenantId: string, entityId: string) {
  return query(
    `SELECT r.predicate, e.kind, e.name
       FROM relations r JOIN entities e ON e.id = r.dst_id
      WHERE r.tenant_id=$1 AND r.src_id=$2
      LIMIT 50`,
    [tenantId, entityId]
  );
}
