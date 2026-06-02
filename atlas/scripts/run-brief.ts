// Generate a brief from the CLI: `npm run brief:run -- weekly tnt_demo`
import { getPool } from "../lib/db";
import { generateBrief } from "../lib/agents/recommender";

async function main() {
  const kind = (process.argv[2] as "weekly" | "quarterly") || "weekly";
  const tenant = process.argv[3] || "tnt_demo";
  console.log(`Generating ${kind} brief for ${tenant}…\n`);
  const { content } = await generateBrief(tenant, kind);
  console.log(content);
  await getPool().end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
