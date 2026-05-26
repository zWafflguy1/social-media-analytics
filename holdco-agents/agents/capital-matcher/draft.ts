import { ask, type LLMUsage } from '../../shared/llm/claude.js';
import type { Deal, Investor } from '../../shared/types.js';

const SYSTEM = `You draft brief, professional outreach emails from a holding-company principal
to a capital partner (family office, PE, HNW investor) about a specific acquisition opportunity.

Style rules:
- Subject: short, specific, no clickbait. E.g. "Lower-MM acquisition opportunity — [industry] in [region]".
- Body: 120-180 words. Open with one sentence acknowledging their focus area.
- Then the deal in 3-5 bullets: industry, location, financials (revenue, SDE/EBITDA), asking price, why it's a fit.
- Close with: equity check ask range, proposed structure (e.g. 20-25% equity / SBA / seller note), next step (15-min call).
- No fluff, no superlatives, no exclamation marks, no "I hope this email finds you well."
- If you don't have a fact, omit it — never fabricate.

Output strict JSON: { "subject": "...", "body": "..." } — body is plain text with newlines.`;

const SCHEMA = `{"subject": "<string>", "body": "<plain text with \\n line breaks>"}`;

export async function draftOutreach(
  deal: Deal,
  investor: Investor,
  matchReasoning: string
): Promise<{ subject: string; body: string; usage: LLMUsage }> {
  const dealCard = [
    `Title: ${deal.title}`,
    deal.industry && `Industry: ${deal.industry}`,
    deal.location && `Location: ${deal.location}`,
    deal.asking_price && `Asking: $${(deal.asking_price / 100).toLocaleString()}`,
    deal.sde && `SDE: $${(deal.sde / 100).toLocaleString()}`,
    deal.ebitda && `EBITDA: $${(deal.ebitda / 100).toLocaleString()}`,
    deal.revenue && `Revenue: $${(deal.revenue / 100).toLocaleString()}`,
    deal.absentee_signal && 'Operator: absentee/semi-absentee',
    deal.reason_for_sale && `Reason for sale: ${deal.reason_for_sale}`,
    deal.score_reasoning && `Internal thesis: ${deal.score_reasoning}`,
  ].filter(Boolean).join('\n');

  const invCard = [
    `Recipient: ${investor.contact_name ?? investor.name}`,
    investor.type && `Type: ${investor.type}`,
    investor.focus_sectors && `Focus: ${investor.focus_sectors}`,
    investor.thesis && `Their stated thesis: ${investor.thesis}`,
    investor.check_size_min && investor.check_size_max &&
      `Their typical check: $${(investor.check_size_min / 100).toLocaleString()}–$${(investor.check_size_max / 100).toLocaleString()}`,
  ].filter(Boolean).join('\n');

  const { parsed, usage } = await ask<{ subject: string; body: string }>({
    system: SYSTEM,
    user: `INVESTOR:\n${invCard}\n\nDEAL:\n${dealCard}\n\nMATCH RATIONALE (internal):\n${matchReasoning}\n\nDraft the email.`,
    tier: 'default',
    maxTokens: 700,
    jsonSchemaHint: SCHEMA,
    cacheSystem: true,
  });

  if (!parsed) return { subject: '(draft failed)', body: 'LLM returned no parseable draft.', usage };
  return { subject: parsed.subject, body: parsed.body, usage };
}
