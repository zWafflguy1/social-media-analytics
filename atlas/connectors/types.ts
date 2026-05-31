import { type EventInput } from "../lib/events/schema";

/**
 * Everything a connector receives at runtime. The framework assembles this so a
 * connector author never touches the database, tenancy, or HTTP plumbing.
 */
export interface ConnectorContext {
  tenantId: string;
  source: string;
  /** Non-secret per-tenant settings (e.g. account id, base url). */
  config: Record<string, string>;
  /** Secrets for this connection (tokens, signing keys). Opaque to the author. */
  secrets: Record<string, string>;
  /** Resume cursor for pull connectors (undefined on first sync). */
  cursor?: string;
  /** Raw inbound request (webhook only): exact body bytes + headers. */
  raw?: { body: string; headers: Headers };
  /** Structured logging that lands in the audit log. */
  log: (message: string, meta?: Record<string, unknown>) => void;
}

export interface SyncResult {
  events: EventInput[];
  /** Persisted so the next sync resumes here. */
  cursor?: string;
}

/** A field the integration UI should collect to connect this source. */
export interface AuthField {
  key: string;
  label: string;
  secret?: boolean;
  required?: boolean;
  help?: string;
}

export interface AuthSpec {
  kind: "oauth2" | "api_key" | "hmac_webhook" | "none";
  fields: AuthField[];
  docsUrl?: string;
}

/**
 * The connector contract. To integrate a new company tool you implement `map`
 * (and optionally `sync` / `verify`) — nothing else. See connectors/template.ts.
 */
export interface ConnectorDefinition<Raw = any> {
  /** Stable id, used in routes (/api/connectors/<source>/...) and storage. */
  source: string;
  displayName: string;
  /** How this source is wired up — drives the integration UI & validation. */
  auth: AuthSpec;

  /**
   * Verify an inbound webhook is authentic (HMAC signature, shared token, …).
   * Return false to reject. Omit for sources that don't push webhooks.
   */
  verify?(ctx: ConnectorContext): boolean | Promise<boolean>;

  /**
   * Transform one raw push payload into normalized events. The ONLY function
   * most integrations need to write.
   */
  map?(payload: Raw, ctx: ConnectorContext): EventInput[] | Promise<EventInput[]>;

  /**
   * Pull new data since `ctx.cursor` and return events + the next cursor.
   * Implement for poll-based sources (no webhooks).
   */
  sync?(ctx: ConnectorContext): SyncResult | Promise<SyncResult>;
}
