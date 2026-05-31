// Seeds a demo tenant with a handful of events, then enriches them so you can
// click through chat / briefs / onboarding immediately. Requires DATABASE_URL
// and ANTHROPIC_API_KEY (or run with ATLAS_EMBEDDING_PROVIDER=local for vectors).
import { getPool, query } from "../lib/db";
import { ingestEvent } from "../lib/events/ingest";
import { enrichPending } from "../lib/enrich/pipeline";
import { type EventInput } from "../lib/events/schema";

const TENANT = "tnt_demo";

const SAMPLE: EventInput[] = [
  {
    source: "dialpad",
    type: "call.completed",
    occurred_at: new Date(Date.now() - 2 * 864e5).toISOString(),
    subject: "Renewal call — Acme Corp",
    body: "Discussed the upcoming renewal with Acme. They're frustrated about support response times last quarter (several tickets took >3 days). Considering competitor. Agreed to a success-plan review next week. Decided to offer a 10% loyalty discount to retain them.",
    actors: [
      { name: "Dana (AE)", role: "rep" },
      { name: "Acme - Priya", role: "customer" },
    ],
    metrics: { duration_s: 1320, sentiment: -0.2 },
    links: { deal: "deal_acme_renewal", account: "Acme Corp" },
    sensitivity: "confidential",
    dedupe_key: "seed:call:1",
    consent: { recorded: true, consented: true, jurisdiction: "NY" },
  },
  {
    source: "gmail",
    type: "email.received",
    occurred_at: new Date(Date.now() - 1 * 864e5).toISOString(),
    subject: "Re: Q2 pipeline review",
    body: "Team — pipeline is healthy but two enterprise deals are stalling at the procurement stage. We keep losing a week waiting on security questionnaires. Proposing we pre-build a security packet. Thoughts?",
    actors: [{ name: "Sales Lead", role: "sender" }],
    metrics: {},
    links: {},
    sensitivity: "internal",
    dedupe_key: "seed:email:1",
  },
  {
    source: "zendesk",
    type: "ticket.resolved",
    occurred_at: new Date(Date.now() - 5 * 864e5).toISOString(),
    subject: "Acme — login outage",
    body: "Acme reported a login outage affecting 40 users. Resolved in 6 hours. Root cause: expired SSO cert. CSAT score 3/5 — customer noted slow first response.",
    actors: [{ name: "Support - Sam", role: "rep" }],
    metrics: { resolution_h: 6, csat: 3 },
    links: { account: "Acme Corp" },
    sensitivity: "internal",
    dedupe_key: "seed:ticket:1",
  },
];

async function main() {
  console.log("Seeding demo tenant…");
  await query(
    `INSERT INTO tenants (id, name, max_autonomy_tier) VALUES ($1,$2,1)
     ON CONFLICT (id) DO NOTHING`,
    [TENANT, "Demo Co"]
  );
  await query(
    `INSERT INTO users (id, tenant_id, email, name, role)
     VALUES ('usr_demo',$1,'owner@demo.co','Demo Owner','owner')
     ON CONFLICT (id) DO NOTHING`,
    [TENANT]
  );

  // Some metrics with a prior point so briefs show movement.
  for (const [name, domain, prior, latest, unit] of [
    ["response_latency_h", "support", 2.1, 3.4, "hours"],
    ["cycle_time_days", "sales", 41, 38, "days"],
    ["mrr", "finance", 82000, 85500, "usd"],
  ] as const) {
    await query(
      `INSERT INTO metrics (tenant_id, name, domain, value, unit, captured_at)
       VALUES ($1,$2,$3,$4,$5, now() - interval '30 days'),
              ($1,$2,$3,$6,$5, now())`,
      [TENANT, name, domain, prior, unit, latest]
    );
  }

  for (const ev of SAMPLE) {
    const r = await ingestEvent(TENANT, ev, ev.source);
    console.log(`  ${ev.type}: ${r.status}`);
  }

  console.log("Enriching…");
  const n = await enrichPending(50);
  console.log(`Enriched ${n} events.`);
  console.log("\nDone. Start the app (npm run dev) and open http://localhost:3000");
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
