import { runRiskScan } from './risk-scan.js';
import { generateAndSendWeeklyReport } from './weekly-report.js';

// Combined entry point — typically the scheduler calls runRiskScan() daily and
// generateAndSendWeeklyReport() every Monday at 5 AM.
async function main() {
  const mode = process.argv[2];
  if (mode === 'report') {
    await generateAndSendWeeklyReport();
  } else {
    await runRiskScan();
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1); });
}
