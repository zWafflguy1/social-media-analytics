// Standalone enrichment worker — drains pending events in a loop. Use this for
// local/background processing; in production trigger /api/enrich from a cron.
import { getPool } from "../lib/db";
import { enrichPending } from "../lib/enrich/pipeline";

const INTERVAL_MS = Number(process.env.ATLAS_ENRICH_INTERVAL_MS ?? 5000);

async function loop() {
  for (;;) {
    try {
      const n = await enrichPending(25);
      if (n > 0) console.log(`[enrich] processed ${n}`);
    } catch (err) {
      console.error("[enrich] error:", (err as Error).message);
    }
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
}

console.log(`Enrichment worker running (interval ${INTERVAL_MS}ms). Ctrl-C to stop.`);
loop().catch(async (err) => {
  console.error(err);
  await getPool().end();
  process.exit(1);
});
