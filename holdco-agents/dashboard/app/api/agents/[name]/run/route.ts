import { NextResponse } from 'next/server';
import { runDealScout } from '../../../../../../agents/deal-scout/index.js';
import { runCapitalMatcher } from '../../../../../../agents/capital-matcher/index.js';
import { runDebtArchitect } from '../../../../../../agents/debt-architect/index.js';
import { runRiskScan } from '../../../../../../agents/portfolio-cfo/risk-scan.js';
import { generateAndSendWeeklyReport } from '../../../../../../agents/portfolio-cfo/weekly-report.js';

const HANDLERS: Record<string, () => Promise<void>> = {
  'deal-scout': runDealScout,
  'capital-matcher': runCapitalMatcher,
  'debt-architect': runDebtArchitect,
  'risk-scan': runRiskScan,
  'weekly-report': generateAndSendWeeklyReport,
};

export async function POST(_req: Request, { params }: { params: { name: string } }) {
  const fn = HANDLERS[params.name];
  if (!fn) return NextResponse.json({ error: 'unknown agent' }, { status: 404 });

  // Fire and forget — return immediately, run in background.
  fn().catch((err) => console.error(`[manual ${params.name}]`, err));
  return NextResponse.json({ ok: true, started: params.name });
}
