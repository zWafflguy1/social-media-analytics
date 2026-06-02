import { NextResponse } from "next/server";
import { CATALOG, CATEGORIES } from "@/connectors/catalog";
import { getConnector } from "@/connectors/registry";
import "@/connectors";

export const runtime = "nodejs";

// The full menu of connectable tools. Each entry is annotated with whether a
// rich in-process connector is wired yet (`ready`), and what it can do. Tools
// without a bespoke connector can still connect via the generic webhook.
export async function GET() {
  const tools = CATALOG.map((c) => {
    const def = getConnector(c.source);
    return {
      ...c,
      ready: Boolean(def),
      capabilities: {
        webhook: Boolean(def?.map),
        sync: Boolean(def?.sync),
      },
    };
  });
  return NextResponse.json({ categories: CATEGORIES, tools });
}
