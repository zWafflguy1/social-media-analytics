import fs from "node:fs";
import path from "node:path";
import { config } from "../config.js";

/**
 * Lightweight JSON-file datastore. Zero native dependencies so the project
 * runs anywhere Node runs. Swap for Postgres/SQLite behind the same
 * interface when you outgrow it.
 */

export interface RankSnapshot {
  query: string;
  engine: "google" | "google_local";
  position: number | null; // null = not in top 100
  topCompetitors: string[];
  checkedAt: string;
}

export interface AeoSnapshot {
  query: string;
  cited: boolean;
  mentioned: boolean;
  citedDomains: string[];
  answerExcerpt: string;
  checkedAt: string;
}

export interface AuditFinding {
  page: string;
  severity: "critical" | "warning" | "info";
  rule: string;
  detail: string;
}

export interface OptimizationAction {
  id: string;
  title: string;
  priority: number; // 1 = highest
  category: "seo" | "aeo" | "local" | "technical" | "content";
  description: string;
  autoApplicable: boolean;
  status: "pending" | "applied" | "dismissed";
  createdAt: string;
}

export interface PageOptimization {
  page: string; // path, e.g. "/" or "/services/drain-cleaning"
  jsonLd: string[]; // serialized JSON-LD blocks to inject
  title?: string;
  metaDescription?: string;
  faq: { question: string; answer: string }[];
}

export interface VitalsBeacon {
  page: string;
  lcp?: number;
  cls?: number;
  inp?: number;
  ttfb?: number;
  receivedAt: string;
}

export interface AgentState {
  lastRunAt: string | null;
  lastRunSummary: string;
  ranks: RankSnapshot[];
  rankHistory: RankSnapshot[];
  aeo: AeoSnapshot[];
  aeoHistory: AeoSnapshot[];
  auditFindings: AuditFinding[];
  actions: OptimizationAction[];
  pageOptimizations: PageOptimization[];
  contentBriefs: { targetQuery: string; intent: string; outline: string[] }[];
  vitals: VitalsBeacon[];
}

const emptyState: AgentState = {
  lastRunAt: null,
  lastRunSummary: "",
  ranks: [],
  rankHistory: [],
  aeo: [],
  aeoHistory: [],
  auditFindings: [],
  actions: [],
  pageOptimizations: [],
  contentBriefs: [],
  vitals: [],
};

const filePath = path.join(config.dataDir, "state.json");
let state: AgentState = load();
let writeTimer: NodeJS.Timeout | null = null;

function load(): AgentState {
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    return { ...emptyState, ...JSON.parse(raw) };
  } catch {
    return structuredClone(emptyState);
  }
}

function persist(): void {
  if (writeTimer) return;
  writeTimer = setTimeout(() => {
    writeTimer = null;
    fs.mkdirSync(config.dataDir, { recursive: true });
    const tmp = filePath + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify(state, null, 2));
    fs.renameSync(tmp, filePath);
  }, 250);
}

export function getState(): AgentState {
  return state;
}

export function update(mutator: (s: AgentState) => void): void {
  mutator(state);
  // Keep history bounded
  state.rankHistory = state.rankHistory.slice(-2000);
  state.aeoHistory = state.aeoHistory.slice(-2000);
  state.vitals = state.vitals.slice(-1000);
  persist();
}
