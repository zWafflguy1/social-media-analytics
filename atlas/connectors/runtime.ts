import { query, queryOne } from "../lib/db";
import { audit } from "../lib/audit";
import { ingestEvent, type IngestResult } from "../lib/events/ingest";
import { EventInputSchema, type EventInput } from "../lib/events/schema";
import { getConnector } from "./registry";
import { type ConnectorContext } from "./types";

export interface ConnectorAccount {
  config: Record<string, string>;
  secrets: Record<string, string>;
  enabled: boolean;
}

/** Load a tenant's connection for a source (config + secrets). */
export async function loadAccount(
  tenantId: string,
  source: string
): Promise<ConnectorAccount | null> {
  const row = await queryOne<ConnectorAccount>(
    `SELECT config, secrets, enabled FROM connector_accounts
      WHERE tenant_id=$1 AND source=$2`,
    [tenantId, source]
  );
  return row;
}

function buildCtx(
  tenantId: string,
  source: string,
  account: ConnectorAccount | null,
  extra: Partial<ConnectorContext> = {}
): ConnectorContext {
  return {
    tenantId,
    source,
    config: account?.config ?? {},
    secrets: account?.secrets ?? {},
    log: (message, meta) =>
      audit(tenantId, `connector:${source}`, "connector.log", source, { message, ...meta }),
    ...extra,
  };
}

/** Validate + ingest a batch of mapped events. Bad events are skipped, not fatal. */
async function ingestMapped(
  tenantId: string,
  source: string,
  events: EventInput[]
): Promise<{ accepted: number; duplicate: number; rejected: number; invalid: number }> {
  const tally = { accepted: 0, duplicate: 0, rejected: 0, invalid: 0 };
  for (const candidate of events) {
    const parsed = EventInputSchema.safeParse(candidate);
    if (!parsed.success) {
      tally.invalid++;
      continue;
    }
    const result: IngestResult = await ingestEvent(tenantId, parsed.data, source);
    tally[result.status]++;
  }
  return tally;
}

export interface WebhookOutcome {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

/**
 * Handle an inbound webhook for any registered source. Resolves the connector,
 * verifies the signature, maps the payload, and ingests — uniformly, so adding
 * a source needs zero new routing code.
 */
export async function receiveWebhook(
  tenantId: string,
  source: string,
  rawBody: string,
  headers: Headers
): Promise<WebhookOutcome> {
  const def = getConnector(source);
  if (!def || !def.map) {
    return { ok: false, status: 404, body: { error: `no webhook connector for "${source}"` } };
  }

  const account = await loadAccount(tenantId, source);
  if (account && account.enabled === false) {
    return { ok: false, status: 403, body: { error: "connector disabled" } };
  }

  const ctx = buildCtx(tenantId, source, account, { raw: { body: rawBody, headers } });

  if (def.verify) {
    const ok = await def.verify(ctx);
    if (!ok) {
      await audit(tenantId, `connector:${source}`, "webhook.rejected", source, {
        reason: "signature verification failed",
      });
      return { ok: false, status: 401, body: { error: "signature verification failed" } };
    }
  }

  let payload: unknown;
  try {
    payload = rawBody ? JSON.parse(rawBody) : {};
  } catch {
    return { ok: false, status: 400, body: { error: "invalid JSON payload" } };
  }

  const events = await def.map(payload, ctx);
  const tally = await ingestMapped(tenantId, source, events);
  await audit(tenantId, `connector:${source}`, "webhook.received", source, tally);
  return { ok: true, status: 202, body: { source, ...tally } };
}

export interface SyncOutcome {
  ok: boolean;
  status: number;
  body: Record<string, unknown>;
}

/**
 * Run a pull/poll sync for a source. Loads the saved cursor, calls the
 * connector's sync(), ingests, and persists the new cursor.
 */
export async function runSync(tenantId: string, source: string): Promise<SyncOutcome> {
  const def = getConnector(source);
  if (!def || !def.sync) {
    return { ok: false, status: 404, body: { error: `no sync connector for "${source}"` } };
  }

  const account = await loadAccount(tenantId, source);
  if (account?.enabled === false) {
    return { ok: false, status: 403, body: { error: "connector disabled" } };
  }

  const state = await queryOne<{ cursor: string | null }>(
    `SELECT cursor FROM connector_sync_state WHERE tenant_id=$1 AND source=$2`,
    [tenantId, source]
  );
  const ctx = buildCtx(tenantId, source, account, { cursor: state?.cursor ?? undefined });

  try {
    const result = await def.sync(ctx);
    const tally = await ingestMapped(tenantId, source, result.events);
    await query(
      `INSERT INTO connector_sync_state (tenant_id, source, cursor, last_synced_at, last_status)
       VALUES ($1,$2,$3, now(), 'ok')
       ON CONFLICT (tenant_id, source) DO UPDATE SET
         cursor=EXCLUDED.cursor, last_synced_at=now(), last_status='ok'`,
      [tenantId, source, result.cursor ?? state?.cursor ?? null]
    );
    await audit(tenantId, `connector:${source}`, "sync.completed", source, tally);
    return { ok: true, status: 200, body: { source, ...tally } };
  } catch (err) {
    await query(
      `INSERT INTO connector_sync_state (tenant_id, source, last_synced_at, last_status)
       VALUES ($1,$2, now(), 'error')
       ON CONFLICT (tenant_id, source) DO UPDATE SET last_synced_at=now(), last_status='error'`,
      [tenantId, source]
    );
    await audit(tenantId, `connector:${source}`, "sync.failed", source, {
      error: (err as Error).message,
    });
    return { ok: false, status: 500, body: { error: (err as Error).message } };
  }
}
