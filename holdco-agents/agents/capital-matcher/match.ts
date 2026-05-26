import { ask, type LLMUsage } from '../../shared/llm/claude.js';
import type { Deal, Investor } from '../../shared/types.js';

const SYSTEM = `You match acquisition targets to capital partners. Score 0-100 on overall fit:
- Sector alignment (does deal industry fit investor focus?)
- Check size (does investor's typical equity check cover the down payment / equity slice?)
- Geography (does deal location fit investor's geo)
- Thesis/style (control vs minority, hold horizon, absentee-friendly, etc.)
- Recency / engagement (penalize if investor was contacted < 30 days ago on a different deal)

Be honest. Score below 50 means "don't bother." 50-70 = warm. 70-85 = strong. 85+ = ideal.
Output strict JSON.`;

const SCHEMA = `{"score": <0-100 int>, "reasoning": "<under 60 words, cite specific alignment>"}`;

export async function scoreMatch(deal: Deal, investor: Investor): Promise<{ score: number; reasoning: string; usage: LLMUsage }> {
  const dealCard = formatDeal(deal);
  const invCard = formatInvestor(investor);

  const { parsed, usage } = await ask<{ score: number; reasoning: string }>({
    system: SYSTEM,
    user: `DEAL:\n${dealCard}\n\nINVESTOR:\n${invCard}`,
    tier: 'default',
    maxTokens: 400,
    jsonSchemaHint: SCHEMA,
    cacheSystem: true,
  });

  if (!parsed || typeof parsed.score !== 'number') {
    return { score: 0, reasoning: 'Parse error', usage };
  }
  return {
    score: Math.max(0, Math.min(100, Math.round(parsed.score))),
    reasoning: parsed.reasoning ?? '',
    usage,
  };
}

function formatDeal(d: Deal): string {
  return [
    `Title: ${d.title}`,
    d.industry && `Industry: ${d.industry}`,
    d.location && `Location: ${d.location}`,
    d.asking_price && `Asking price: $${(d.asking_price / 100).toLocaleString()}`,
    d.sde && `SDE: $${(d.sde / 100).toLocaleString()}`,
    d.ebitda && `EBITDA: $${(d.ebitda / 100).toLocaleString()}`,
    d.revenue && `Revenue: $${(d.revenue / 100).toLocaleString()}`,
    d.score != null && `Internal score: ${d.score}/100`,
    d.absentee_signal && 'Absentee-friendly: yes',
    d.score_reasoning && `Notes: ${d.score_reasoning}`,
  ].filter(Boolean).join('\n');
}

function formatInvestor(i: Investor): string {
  return [
    `Name: ${i.name}`,
    i.type && `Type: ${i.type}`,
    i.focus_sectors && `Sectors: ${i.focus_sectors}`,
    i.check_size_min && `Min check: $${(i.check_size_min / 100).toLocaleString()}`,
    i.check_size_max && `Max check: $${(i.check_size_max / 100).toLocaleString()}`,
    i.geography && `Geography: ${i.geography}`,
    i.thesis && `Thesis: ${i.thesis}`,
    i.last_contacted_at && `Last contacted: ${new Date(i.last_contacted_at * 1000).toISOString().split('T')[0]}`,
  ].filter(Boolean).join('\n');
}
