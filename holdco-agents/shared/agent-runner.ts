import { db, now } from './db/client.js';
import type { AgentName } from './types.js';
import { estimateCostCents, type LLMTier, type LLMUsage } from './llm/claude.js';

export type RunHandle = {
  id: number;
  recordUsage: (tier: LLMTier, usage: LLMUsage) => void;
  finish: (args: { status: 'success' | 'failed'; summary?: string; error?: string; itemsProcessed?: number; itemsCreated?: number }) => void;
};

export function startRun(agent: AgentName): RunHandle {
  const stmt = db().prepare(
    `INSERT INTO agent_runs (agent_name, started_at, status) VALUES (?, ?, 'running')`
  );
  const result = stmt.run(agent, now());
  const id = Number(result.lastInsertRowid);

  let tokensIn = 0;
  let tokensOut = 0;
  let costCents = 0;

  return {
    id,
    recordUsage(tier, usage) {
      tokensIn += usage.input_tokens + usage.cache_creation_tokens + usage.cache_read_tokens;
      tokensOut += usage.output_tokens;
      costCents += estimateCostCents(usage, tier);
    },
    finish({ status, summary, error, itemsProcessed = 0, itemsCreated = 0 }) {
      db().prepare(
        `UPDATE agent_runs
         SET finished_at = ?, status = ?, summary = ?, error = ?,
             items_processed = ?, items_created = ?,
             tokens_in = ?, tokens_out = ?, cost_cents = ?
         WHERE id = ?`
      ).run(now(), status, summary ?? null, error ?? null, itemsProcessed, itemsCreated, tokensIn, tokensOut, costCents, id);
    },
  };
}
