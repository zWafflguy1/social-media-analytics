import type { EventInput } from "./events/schema";

// US two-party (all-party) consent states for call recording. Calls recorded in
// these jurisdictions must carry explicit consent or Atlas refuses to ingest.
const ALL_PARTY_CONSENT = new Set([
  "CA", "DE", "FL", "IL", "MD", "MA", "MI", "MT", "NH", "OR", "PA", "WA",
]);

export interface ConsentDecision {
  allowed: boolean;
  reason?: string;
}

export function checkConsent(ev: EventInput): ConsentDecision {
  const c = ev.consent;
  // Non-recorded events (emails, CRM updates, metrics) need no consent gate.
  if (!c?.recorded) return { allowed: true };

  if (!c.consented) {
    return { allowed: false, reason: "recorded media without consent attestation" };
  }
  // In all-party states, a generic flag isn't enough without a jurisdiction.
  const j = (c.jurisdiction ?? "").toUpperCase();
  if (ALL_PARTY_CONSENT.has(j) && !c.consented) {
    return { allowed: false, reason: `all-party consent required in ${j}` };
  }
  return { allowed: true };
}
