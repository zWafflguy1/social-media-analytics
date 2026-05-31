import { nanoid } from "nanoid";
import { complete } from "../anthropic";
import { query } from "../db";
import { audit } from "../audit";
import { retrieve, renderContext } from "../knowledge/retrieve";

const SYSTEM = `You are Atlas, onboarding a new team member. Using the company's
own history, write a "get up to speed fast" brief in Markdown for the given
role. Sections:
## What this role does here
## Key accounts / relationships you'll inherit
## How we do things (patterns & norms observed)
## Decisions & context you should know
## Your first-week checklist
Ground everything in the provided context and cite event ids in brackets where
relevant. This should make someone productive on day one, not week nine.`;

/**
 * Pillar 1 — expedite onboarding. Generates a role-specific brief from the
 * institutional memory so a new hire is instantly in sync. Tier-0, read-only.
 */
export async function onboardingBrief(
  tenantId: string,
  role: string,
  focus?: string
): Promise<{ id: string; content: string }> {
  // Pull a broad slice relevant to the role.
  const queryText = `${role} responsibilities, key accounts, processes, decisions ${focus ?? ""}`;
  const chunks = await retrieve(tenantId, queryText, 16);

  const content = await complete(
    `Role: ${role}\nFocus areas: ${focus ?? "general"}\n\nCompany context:\n${
      chunks.length ? renderContext(chunks) : "(limited history available)"
    }`,
    { tier: "heavy", system: SYSTEM, cacheSystem: true, maxTokens: 2500 }
  );

  const id = `brf_${nanoid(12)}`;
  await query(
    `INSERT INTO briefs (id, tenant_id, kind, period, content, meta)
     VALUES ($1,$2,'onboarding',$3,$4,$5)`,
    [id, tenantId, role, content, JSON.stringify({ focus })]
  );
  await audit(tenantId, "agent", "onboarding.generated", id, { role });

  return { id, content };
}
