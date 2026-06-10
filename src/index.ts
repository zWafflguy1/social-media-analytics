import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { config } from "./config.js";
import { router } from "./api/routes.js";
import { runAgentCycle } from "./agent/orchestrator.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();

app.use(express.json({ limit: "100kb" }));
// CORS: embed.js runs on the customer's site, which is a different origin.
app.use((req, res, next) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Headers", "Content-Type");
  res.set("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
  if (req.method === "OPTIONS") return res.status(204).end();
  next();
});

app.use(router);
app.use(express.static(path.join(__dirname, "..", "public")));

app.listen(config.port, () => {
  console.log(`ai-seo-ranking-agent listening on http://localhost:${config.port}`);
  console.log(`  site:      ${config.siteUrl}`);
  console.log(`  market:    ${config.market}`);
  console.log(`  site key:  ${config.siteKey}${process.env.SITE_KEY ? "" : "  (generated — set SITE_KEY in .env to keep it stable)"}`);
  console.log(`  dashboard: http://localhost:${config.port}/dashboard.html?key=${config.siteKey}`);
  console.log(`  embed tag: <script src="http://localhost:${config.port}/embed.js" data-key="${config.siteKey}" defer></script>`);
});

const runOnce = process.argv.includes("--once");
const intervalMs = config.agentIntervalHours * 3600 * 1000;

async function cycle() {
  try {
    await runAgentCycle();
  } catch (err) {
    console.error("[agent] cycle failed:", err);
  }
}

// First cycle shortly after boot, then on the configured interval.
setTimeout(cycle, 5000);
if (!runOnce) setInterval(cycle, intervalMs);
