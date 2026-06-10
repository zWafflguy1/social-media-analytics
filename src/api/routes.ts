import { Router } from "express";
import { config } from "../config.js";
import { getState, update } from "../store/db.js";
import { runAgentCycle } from "../agent/orchestrator.js";

export const router = Router();

function requireSiteKey(key: unknown): boolean {
  return typeof key === "string" && key === config.siteKey;
}

/**
 * Embed endpoint — called by embed.js on every page load.
 * Returns only the client-applicable optimizations for the requested page.
 */
router.get("/embed/v1/optimizations", (req, res) => {
  if (!requireSiteKey(req.query.key)) return res.status(401).json({ error: "bad site key" });
  const page = typeof req.query.page === "string" ? req.query.page : "/";
  const state = getState();
  const po = state.pageOptimizations.find((p) => p.page === page);
  res.set("Cache-Control", "public, max-age=300");
  res.json({
    page,
    jsonLd: po?.jsonLd ?? [],
    title: po?.title ?? null,
    metaDescription: po?.metaDescription ?? null,
    faq: po?.faq ?? [],
  });
});

/** Embed beacon — Core Web Vitals reported from real visitors. */
router.post("/embed/v1/vitals", (req, res) => {
  if (!requireSiteKey(req.query.key)) return res.status(401).json({ error: "bad site key" });
  const { page, lcp, cls, inp, ttfb } = req.body ?? {};
  if (typeof page !== "string") return res.status(400).json({ error: "page required" });
  update((s) => {
    s.vitals.push({
      page,
      lcp: numOrUndef(lcp),
      cls: numOrUndef(cls),
      inp: numOrUndef(inp),
      ttfb: numOrUndef(ttfb),
      receivedAt: new Date().toISOString(),
    });
  });
  res.status(204).end();
});

/** Dashboard/API: full agent state (rankings, AEO, findings, actions). */
router.get("/api/v1/state", (req, res) => {
  if (!requireSiteKey(req.query.key)) return res.status(401).json({ error: "bad site key" });
  const s = getState();
  res.json({
    lastRunAt: s.lastRunAt,
    summary: s.lastRunSummary,
    ranks: s.ranks,
    aeo: s.aeo,
    auditFindings: s.auditFindings,
    actions: s.actions,
    pageOptimizations: s.pageOptimizations,
    contentBriefs: s.contentBriefs,
    vitalsCount: s.vitals.length,
  });
});

/** Manually trigger an agent cycle. */
let running = false;
router.post("/api/v1/run", async (req, res) => {
  if (!requireSiteKey(req.query.key)) return res.status(401).json({ error: "bad site key" });
  if (running) return res.status(409).json({ error: "cycle already running" });
  running = true;
  runAgentCycle()
    .catch((err) => console.error("[agent] cycle failed:", err))
    .finally(() => (running = false));
  res.status(202).json({ status: "started" });
});

/** Update an action's status (applied / dismissed). */
router.post("/api/v1/actions/:id/status", (req, res) => {
  if (!requireSiteKey(req.query.key)) return res.status(401).json({ error: "bad site key" });
  const { status } = req.body ?? {};
  if (!["pending", "applied", "dismissed"].includes(status))
    return res.status(400).json({ error: "status must be pending|applied|dismissed" });
  let found = false;
  update((s) => {
    const action = s.actions.find((a) => a.id === req.params.id);
    if (action) {
      action.status = status;
      found = true;
    }
  });
  if (!found) return res.status(404).json({ error: "action not found" });
  res.json({ ok: true });
});

function numOrUndef(v: unknown): number | undefined {
  return typeof v === "number" && Number.isFinite(v) ? v : undefined;
}
