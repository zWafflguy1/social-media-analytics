import { NextRequest, NextResponse } from "next/server";
import { query } from "@/lib/db";
import { audit } from "@/lib/audit";
import { resolveTenant, TenantError } from "@/lib/tenancy";
import { catalogEntry } from "@/connectors/catalog";

export const runtime = "nodejs";

async function tenant(req: NextRequest) {
  return resolveTenant(req);
}

// GET — this tenant's data inputs: each connection with status, what data it's
// providing, and how much. Secret VALUES are never returned — only which keys
// are set, so the UI can show "configured" without exposing tokens.
export async function GET(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const rows = await query(
    `SELECT a.source,
            a.display_name,
            a.enabled,
            a.config,
            ARRAY(SELECT jsonb_object_keys(a.secrets)) AS secret_keys,
            a.updated_at,
            s.last_synced_at,
            s.last_status,
            COALESCE(ev.cnt, 0)        AS event_count,
            COALESCE(ev.types, '{}')   AS event_types,
            ev.last_event_at
       FROM connector_accounts a
       LEFT JOIN connector_sync_state s
         ON s.tenant_id = a.tenant_id AND s.source = a.source
       LEFT JOIN (
            SELECT source, COUNT(*) AS cnt,
                   ARRAY_AGG(DISTINCT type) AS types,
                   MAX(occurred_at) AS last_event_at
              FROM events WHERE tenant_id = $1 GROUP BY source
       ) ev ON ev.source = a.source
      WHERE a.tenant_id = $1
      ORDER BY a.source`,
    [tenantId]
  );

  return NextResponse.json({ connections: rows });
}

// POST — connect / reconfigure a source.
//   { source, display_name?, config?, secrets?, enabled? }
// Secrets are merged (omitting a key leaves the stored value untouched).
export async function POST(req: NextRequest) {
  let tenantId: string;
  try {
    tenantId = await tenant(req);
  } catch (e) {
    if (e instanceof TenantError) return NextResponse.json({ error: e.message }, { status: 400 });
    throw e;
  }

  const body = (await req.json().catch(() => ({}))) as {
    source?: string;
    display_name?: string;
    config?: Record<string, string>;
    secrets?: Record<string, string>;
    enabled?: boolean;
  };

  if (!body.source) {
    return NextResponse.json({ error: "source is required" }, { status: 422 });
  }
  const entry = catalogEntry(body.source);
  if (!entry) {
    return NextResponse.json({ error: `unknown source: ${body.source}` }, { status: 422 });
  }

  await query(
    `INSERT INTO connector_accounts (tenant_id, source, display_name, config, secrets, enabled)
     VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, COALESCE($6, true))
     ON CONFLICT (tenant_id, source) DO UPDATE SET
       display_name = COALESCE(EXCLUDED.display_name, connector_accounts.display_name),
       config       = connector_accounts.config || EXCLUDED.config,
       secrets      = connector_accounts.secrets || EXCLUDED.secrets,
       enabled      = COALESCE($6, connector_accounts.enabled),
       updated_at   = now()`,
    [
      tenantId,
      body.source,
      body.display_name ?? entry.name,
      JSON.stringify(body.config ?? {}),
      JSON.stringify(body.secrets ?? {}),
      body.enabled ?? null,
    ]
  );

  await audit(tenantId, "user", "connector.configured", body.source, {
    secret_keys: Object.keys(body.secrets ?? {}),
  });
  return NextResponse.json({ ok: true, source: body.source });
}
