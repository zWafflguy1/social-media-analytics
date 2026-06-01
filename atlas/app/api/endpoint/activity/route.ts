import { NextRequest, NextResponse } from "next/server";
import { authenticateDevice } from "@/lib/monitoring/devices";
import { ingestActivity } from "@/lib/monitoring/activity";
import { type RawActivity } from "@/lib/monitoring/policy";

export const runtime = "nodejs";
export const maxDuration = 120;

// POST — the desktop agent reports activity. Auth is the device id + agent key
// (NOT the tenant header); the consent gate + policy run inside ingestActivity.
//   headers: x-device-id, x-agent-key
//   body: { events: RawActivity[] }
export async function POST(req: NextRequest) {
  const deviceId = req.headers.get("x-device-id");
  const agentKey = req.headers.get("x-agent-key");
  if (!deviceId || !agentKey) {
    return NextResponse.json({ error: "missing device credentials" }, { status: 401 });
  }

  const device = await authenticateDevice(deviceId, agentKey);
  if (!device) {
    return NextResponse.json({ error: "device authentication failed" }, { status: 401 });
  }

  const { events } = (await req.json().catch(() => ({}))) as { events?: RawActivity[] };
  if (!Array.isArray(events)) {
    return NextResponse.json({ error: "events array is required" }, { status: 422 });
  }

  const result = await ingestActivity(device, events);
  const status = result.status === "rejected" ? 403 : 202;
  return NextResponse.json(result, { status });
}
