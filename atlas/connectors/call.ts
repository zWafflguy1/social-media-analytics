import { type Connector } from "./base";
import { type EventInput } from "../lib/events/schema";

// Example: a call platform (Dialpad/Aircall/Zoom) webhook for a completed,
// transcribed call. Note the consent block — Atlas refuses recorded media that
// isn't attested as consented (see lib/consent.ts).
interface RawCall {
  id: string;
  startedAt: string;
  durationSeconds: number;
  participants: { name: string; role: "rep" | "customer" }[];
  transcript: string;
  consentCaptured: boolean;
  jurisdiction?: string; // e.g. "CA"
  dealId?: string;
}

export const callConnector: Connector = {
  source: "dialpad",
  handleWebhook(payload: unknown): EventInput[] {
    const call = payload as RawCall;
    return [
      {
        source: "dialpad",
        type: "call.completed",
        occurred_at: new Date(call.startedAt).toISOString(),
        subject: `Call with ${call.participants.map((p) => p.name).join(", ")}`,
        body: call.transcript,
        actors: call.participants.map((p) => ({ name: p.name, role: p.role })),
        metrics: { duration_s: call.durationSeconds },
        links: call.dealId ? { deal: call.dealId } : {},
        sensitivity: "confidential",
        dedupe_key: `dialpad:${call.id}`,
        consent: {
          recorded: true,
          consented: call.consentCaptured,
          jurisdiction: call.jurisdiction,
        },
      },
    ];
  },
};
