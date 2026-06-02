import { NextResponse } from "next/server";
import { listConnectors } from "@/connectors/registry";
import "@/connectors";

export const runtime = "nodejs";

// Catalog of available connectors + the fields each needs to connect. An
// integration UI renders straight from this — add a connector, it appears here.
export async function GET() {
  return NextResponse.json({
    connectors: listConnectors().map((c) => ({
      source: c.source,
      displayName: c.displayName,
      auth: c.auth,
      capabilities: {
        webhook: typeof c.map === "function",
        sync: typeof c.sync === "function",
        verifies: typeof c.verify === "function",
      },
    })),
  });
}
