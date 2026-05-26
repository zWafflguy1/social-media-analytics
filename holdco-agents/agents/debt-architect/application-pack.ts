import { ask, type LLMUsage } from '../../shared/llm/claude.js';
import type { Deal, Lender } from '../../shared/types.js';

const SYSTEM = `You produce a complete loan application narrative package for a small-business
acquisition. The output is markdown and will be reviewed by a human principal before being
formatted into the lender's actual application forms. Use formal but plain language.

Required sections (in this exact order):

# Executive Summary
2-3 paragraphs: who is acquiring, what business, total uses of funds, requested loan amount
and product, top-line strengths, key risks and mitigants.

# Business Overview
History (founding year), industry, products/services, customer base, geography, current
ownership structure, reason for sale, why this fits buyer's strategy.

# Management & Operations
Current management team, owner involvement (especially absentee-friendliness), retained
employees, key-person risk and mitigation, day-1 operating plan.

# Financial Summary
Table of last 3 years revenue / SDE / EBITDA / cash flow (use "not available" honestly when data
absent). Add-back commentary if applicable. Projections for next 24 months — be conservative.

# Sources & Uses
Markdown table showing:
| Source | Amount | % |
| Uses   | Amount | % |
Stack must total to purchase price + closing costs + working capital.

# Debt Service Coverage Analysis
Show projected annual debt service, projected SDE/EBITDA, resulting DSCR. Target >= 1.25x.
Be explicit about assumptions.

# Collateral
Real estate, equipment, A/R, inventory, business assets, personal guarantees offered.

# Risk Factors & Mitigants
Top 5 risks with mitigants.

# Closing & Use of Working Capital
30/60/90 day plan post-close.

Output strict JSON with two fields:
{
  "requested_amount_usd": <number, the loan amount requested from THIS lender>,
  "term_months": <number>,
  "package_md": "<the full markdown document>"
}`;

const SCHEMA = `{"requested_amount_usd": <number>, "term_months": <number>, "package_md": "<markdown>"}`;

export async function buildApplicationPackage(
  deal: Deal,
  lender: Lender,
  product: string
): Promise<{ md: string; requestedAmount: number; termMonths: number; usage: LLMUsage }> {
  const facts = [
    `Acquirer: HoldCo (NewCo to be formed as acquisition vehicle)`,
    `Target: ${deal.title}`,
    deal.industry && `Industry: ${deal.industry}`,
    deal.location && `Location: ${deal.location}`,
    deal.asking_price && `Purchase price (asking): $${(deal.asking_price / 100).toLocaleString()}`,
    deal.sde && `SDE (TTM): $${(deal.sde / 100).toLocaleString()}`,
    deal.ebitda && `EBITDA (TTM): $${(deal.ebitda / 100).toLocaleString()}`,
    deal.revenue && `Revenue (TTM): $${(deal.revenue / 100).toLocaleString()}`,
    deal.cash_flow && `Cash flow: $${(deal.cash_flow / 100).toLocaleString()}`,
    deal.employees && `Employees: ${deal.employees}`,
    deal.established_year && `Established: ${deal.established_year}`,
    deal.reason_for_sale && `Reason for sale: ${deal.reason_for_sale}`,
    deal.absentee_signal && `Absentee/semi-absentee operated: yes`,
    deal.description && `Description:\n${deal.description.slice(0, 3000)}`,
  ].filter(Boolean).join('\n');

  const lenderInfo = `Lender: ${lender.name} (${lender.type}${lender.sba_preferred ? ', SBA-preferred' : ''})
Product requested: ${product}
Lender range: ${lender.min_loan ? `$${(lender.min_loan / 100).toLocaleString()}` : '?'} - ${lender.max_loan ? `$${(lender.max_loan / 100).toLocaleString()}` : '?'}
Typical rate: ${lender.typical_rate ?? 'unspecified'}`;

  const { parsed, usage } = await ask<{ requested_amount_usd: number; term_months: number; package_md: string }>({
    system: SYSTEM,
    user: `${lenderInfo}\n\nDEAL FACTS:\n${facts}\n\nDraft the full application package.`,
    tier: 'heavy',                       // Opus for the long, structured doc
    maxTokens: 6000,
    jsonSchemaHint: SCHEMA,
    cacheSystem: true,
  });

  if (!parsed) {
    return {
      md: `# Application package — generation failed\n\nLLM returned no parseable response.`,
      requestedAmount: 0,
      termMonths: 0,
      usage,
    };
  }

  return {
    md: parsed.package_md,
    requestedAmount: Math.round(Number(parsed.requested_amount_usd) * 100),
    termMonths: Number(parsed.term_months) || 120,
    usage,
  };
}
