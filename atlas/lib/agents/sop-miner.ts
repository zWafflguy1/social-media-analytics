import { completeJSON } from "../anthropic";
import { query } from "../db";
import { audit } from "../audit";
import { createSOP } from "../sops/store";

interface MinedSOP {
  title: string;
  role: string;
  steps: string[];
  rationale: string;
}

const SYSTEM = `You are Atlas, capturing a business's tribal knowledge. Given a
sample of how work actually gets done (activity summaries, calls, emails grouped
by role), infer the REPEATABLE standard operating procedures that high performers
follow. Return ONLY JSON:
{ "sops": [ { "title": "...", "role": "...", "steps": ["step 1","step 2"], "rationale": "why this works" } ] }
Rules: only propose SOPs you see real, repeated evidence for. Steps must be
concrete and actionable. Prefer 3-8 high-value SOPs over many weak ones.`;

/**
 * Mine standard operating procedures from observed work. Proposes SOPs (status
 * 'proposed', source 'inferred') for a human to confirm — turning informal
 * tribal knowledge into standardized, reusable procedure.
 */
export async function mineSOPs(tenantId: string, role?: string): Promise<number> {
  const rows = await query<{ summary: string; role: string | null }>(
    `SELECT en.summary, e.actors->0->>'role' AS role
       FROM enrichments en JOIN events e ON e.id = en.event_id
      WHERE en.tenant_id=$1
        AND e.occurred_at > now() - interval '60 days'
      ORDER BY e.occurred_at DESC
      LIMIT 200`,
    [tenantId]
  );
  if (rows.length === 0) return 0;

  const sample = rows.map((r) => `- ${r.summary}`).join("\n");
  const prompt = `${role ? `Focus on the "${role}" role.\n\n` : ""}Observed work (recent):\n${sample}`;

  const result = await completeJSON<{ sops: MinedSOP[] }>(prompt, {
    tier: "heavy",
    system: SYSTEM,
    cacheSystem: true,
    maxTokens: 2500,
  });

  let created = 0;
  for (const sop of result.sops ?? []) {
    await createSOP(tenantId, {
      title: sop.title,
      role: sop.role,
      steps: sop.steps,
      rationale: sop.rationale,
      source: "inferred",
      confidence: 0.6,
      status: "proposed",
    });
    created++;
  }
  await audit(tenantId, "agent", "sop.mined", undefined, { created, role: role ?? "all" });
  return created;
}
