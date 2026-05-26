import cron from 'node-cron';
import 'dotenv/config';
import { runDealScout } from '../agents/deal-scout/index.js';
import { runCapitalMatcher } from '../agents/capital-matcher/index.js';
import { runDebtArchitect } from '../agents/debt-architect/index.js';
import { runRiskScan } from '../agents/portfolio-cfo/risk-scan.js';
import { generateAndSendWeeklyReport } from '../agents/portfolio-cfo/weekly-report.js';
import { db } from '../shared/db/client.js';

const DEAL_SCOUT_CRON = process.env.DEAL_SCOUT_CRON ?? '0 */6 * * *';      // every 6 hrs
const MATCHER_CRON    = process.env.MATCHER_CRON    ?? '15 */6 * * *';      // 15min after scout
const DEBT_CRON       = process.env.DEBT_CRON       ?? '30 */6 * * *';      // 30min after scout
const RISK_SCAN_CRON  = process.env.RISK_SCAN_CRON  ?? '0 7 * * *';         // daily 7 AM
const REPORT_CRON     = process.env.WEEKLY_REPORT_CRON ?? '0 5 * * 1';      // Mon 5 AM

db();                                                                       // ensure schema applied

function wrap(name: string, fn: () => Promise<void>) {
  return async () => {
    console.log(`[scheduler] ${name} starting at ${new Date().toISOString()}`);
    try { await fn(); console.log(`[scheduler] ${name} done.`); }
    catch (e) { console.error(`[scheduler] ${name} failed:`, e); }
  };
}

cron.schedule(DEAL_SCOUT_CRON, wrap('deal-scout',      runDealScout));
cron.schedule(MATCHER_CRON,    wrap('capital-matcher', runCapitalMatcher));
cron.schedule(DEBT_CRON,       wrap('debt-architect',  runDebtArchitect));
cron.schedule(RISK_SCAN_CRON,  wrap('risk-scan',       runRiskScan));
cron.schedule(REPORT_CRON,     wrap('weekly-report',   generateAndSendWeeklyReport));

console.log('[scheduler] running. Cron expressions:');
console.log(`  deal-scout      ${DEAL_SCOUT_CRON}`);
console.log(`  capital-matcher ${MATCHER_CRON}`);
console.log(`  debt-architect  ${DEBT_CRON}`);
console.log(`  risk-scan       ${RISK_SCAN_CRON}`);
console.log(`  weekly-report   ${REPORT_CRON}`);
console.log('Dashboard: http://localhost:3000');

// Keep process alive
process.stdin.resume();
