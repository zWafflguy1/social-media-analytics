import { nanoid } from "nanoid";
import pgvector from "pgvector/pg";
import { query, queryOne, withTx } from "../db";
import { audit } from "../audit";
import { analyzeEvent } from "./analyze";
import { embed } from "./embed";
import { upsertEntity, addRelation } from "../knowledge/graph";

interface EventRow {
  id: string;
  tenant_id: string;
  source: string;
  type: string;
  subject: string | null;
  body: string | null;
  actors: unknown;
}

/**
 * Enrich one pending event: summarize → extract entities/decision → embed →
 * index into the graph + vector store. Marks the event enriched (or failed).
 */
export async function enrichEvent(eventId: string): Promise<void> {
  const ev = await queryOne<EventRow>(
    `SELECT id, tenant_id, source, type, subject, body, actors
       FROM events WHERE id=$1`,
    [eventId]
  );
  if (!ev) return;

  try {
    const analysis = await analyzeEvent(ev);

    // Embed the summary (primary semantic unit) — cheap, high-signal.
    const summaryVec = await embed(analysis.summary || ev.subject || "");

    await withTx(async (client) => {
      // 1. Enrichment row
      await client.query(
        `INSERT INTO enrichments
           (event_id, tenant_id, summary, action_items, sentiment, urgency, topics)
         VALUES ($1,$2,$3,$4,$5,$6,$7)
         ON CONFLICT (event_id) DO UPDATE SET
           summary=EXCLUDED.summary, action_items=EXCLUDED.action_items,
           sentiment=EXCLUDED.sentiment, urgency=EXCLUDED.urgency, topics=EXCLUDED.topics`,
        [
          ev.id,
          ev.tenant_id,
          analysis.summary,
          JSON.stringify(analysis.action_items),
          analysis.sentiment,
          analysis.urgency,
          analysis.topics,
        ]
      );

      // 2. Vector index (summary kind)
      await client.query(
        `INSERT INTO embeddings (tenant_id, event_id, kind, content, embedding)
         VALUES ($1,$2,'summary',$3,$4)`,
        [ev.tenant_id, ev.id, analysis.summary, pgvector.toSql(summaryVec)]
      );

      // 3. Mark enriched
      await client.query(`UPDATE events SET status='enriched' WHERE id=$1`, [ev.id]);
    });

    // 4. Graph — link extracted entities to the event (outside the tx is fine;
    //    entity upserts are idempotent).
    const eventEntityId = await upsertEntity(ev.tenant_id, "event", ev.id, {
      type: ev.type,
    });
    for (const ent of analysis.entities) {
      const id = await upsertEntity(ev.tenant_id, ent.kind, ent.name);
      await addRelation(ev.tenant_id, id, "mentioned_in", eventEntityId, ev.id);
    }

    // 5. Decision detection → proposed decision (confidence < 1, AI-inferred).
    if (analysis.decision?.title) {
      await query(
        `INSERT INTO decisions
           (id, tenant_id, title, rationale, source_event, confidence, status)
         VALUES ($1,$2,$3,$4,$5,0.6,'proposed')`,
        [
          `dec_${nanoid(12)}`,
          ev.tenant_id,
          analysis.decision.title,
          analysis.decision.rationale ?? null,
          ev.id,
        ]
      );
    }

    await audit(ev.tenant_id, "agent", "event.enriched", ev.id, {
      topics: analysis.topics,
      entities: analysis.entities.length,
      proposed_decision: Boolean(analysis.decision?.title),
    });
  } catch (err) {
    await query(`UPDATE events SET status='failed' WHERE id=$1`, [eventId]);
    await audit(ev.tenant_id, "agent", "event.enrich_failed", eventId, {
      error: (err as Error).message,
    });
    throw err;
  }
}

/** Drain pending events. Called by the worker / cron. */
export async function enrichPending(limit = 25): Promise<number> {
  const rows = await query<{ id: string }>(
    `SELECT id FROM events WHERE status='pending' ORDER BY occurred_at ASC LIMIT $1`,
    [limit]
  );
  for (const r of rows) await enrichEvent(r.id);
  return rows.length;
}
