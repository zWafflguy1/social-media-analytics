import { defineConnector, event, actor, verifyHmac } from "./base";

// Example PUSH connector: a call platform (Dialpad/Aircall/Zoom) completed,
// transcribed call. Note the consent block — Atlas refuses recorded media that
// isn't attested as consented (lib/consent.ts).
interface RawCall {
  id: string;
  startedAt: string;
  durationSeconds: number;
  participants: { name: string; role: "rep" | "customer" }[];
  transcript: string;
  consentCaptured: boolean;
  jurisdiction?: string;
  dealId?: string;
}

export const callConnector = defineConnector<RawCall>({
  source: "dialpad",
  displayName: "Dialpad (calls + transcripts)",
  auth: {
    kind: "hmac_webhook",
    docsUrl: "https://developers.dialpad.com",
    fields: [
      { key: "signing_secret", label: "Webhook signing secret", secret: true, required: true },
    ],
  },

  // HMAC-SHA256 of the raw body, common across call/payment providers.
  verify(ctx) {
    return verifyHmac({
      body: ctx.raw?.body ?? "",
      signature: ctx.raw?.headers.get("x-dialpad-signature") ?? null,
      secret: ctx.secrets.signing_secret ?? "",
    });
  },

  map(call) {
    return [
      event({
        source: "dialpad",
        type: "call.completed",
        id: call.id,
        occurredAt: call.startedAt,
        subject: `Call with ${call.participants.map((p) => p.name).join(", ")}`,
        body: call.transcript,
        actors: call.participants.map((p) =>
          p.role === "rep" ? actor.rep(p.name) : actor.customer(p.name)
        ),
        metrics: { duration_s: call.durationSeconds },
        links: call.dealId ? { deal: call.dealId } : {},
        sensitivity: "confidential",
        consent: {
          recorded: true,
          consented: call.consentCaptured,
          jurisdiction: call.jurisdiction,
        },
      }),
    ];
  },
});
