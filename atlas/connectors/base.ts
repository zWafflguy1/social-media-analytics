import { type EventInput } from "../lib/events/schema";

/**
 * A connector's only job: turn source-specific data into normalized EventInputs
 * and hand them to the ingest endpoint. Push connectors implement `handleWebhook`;
 * pull connectors implement `poll`. Both produce the same universal event shape.
 */
export interface Connector {
  source: string;
  /** Transform an inbound webhook payload into events. */
  handleWebhook?(payload: unknown): EventInput[] | Promise<EventInput[]>;
  /** Pull new data since a cursor; return events + the next cursor. */
  poll?(cursor?: string): Promise<{ events: EventInput[]; cursor?: string }>;
}

/** POST events to the Atlas ingest endpoint for a tenant. */
export async function deliver(
  baseUrl: string,
  tenantId: string,
  ingestSecret: string,
  events: EventInput[]
): Promise<void> {
  for (const ev of events) {
    await fetch(`${baseUrl}/api/events`, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-atlas-tenant": tenantId,
        "x-atlas-ingest-secret": ingestSecret,
      },
      body: JSON.stringify(ev),
    });
  }
}
