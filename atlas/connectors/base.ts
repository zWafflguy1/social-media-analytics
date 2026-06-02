// Re-exports so connector authors import everything from one place.
export { defineConnector, getConnector, listConnectors } from "./registry";
export { event, actor, verifyHmac, verifyToken } from "./helpers";
export type {
  ConnectorDefinition,
  ConnectorContext,
  SyncResult,
  AuthSpec,
  AuthField,
} from "./types";

/**
 * For OUT-OF-PROCESS connectors (a separate service that can't import this
 * package), POST normalized events straight to the ingest endpoint. In-process
 * connectors don't need this — they just implement map()/sync().
 */
import { type EventInput } from "../lib/events/schema";
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
