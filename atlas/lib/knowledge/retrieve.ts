import pgvector from "pgvector/pg";
import { query } from "../db";
import { embed } from "../enrich/embed";

export interface RetrievedChunk {
  event_id: string;
  source: string;
  type: string;
  occurred_at: string;
  content: string;
  similarity: number;
}

/**
 * Semantic retrieval scoped to a tenant. Returns the most relevant enriched
 * summaries for a query — the evidence the agent reasons over and cites.
 */
export async function retrieve(
  tenantId: string,
  queryText: string,
  k = 8
): Promise<RetrievedChunk[]> {
  const qVec = await embed(queryText);
  return query<RetrievedChunk>(
    `SELECT em.event_id,
            e.source,
            e.type,
            e.occurred_at,
            em.content,
            1 - (em.embedding <=> $2) AS similarity
       FROM embeddings em
       JOIN events e ON e.id = em.event_id
      WHERE em.tenant_id = $1
      ORDER BY em.embedding <=> $2
      LIMIT $3`,
    [tenantId, pgvector.toSql(qVec), k]
  );
}

// Render retrieved chunks into a compact, citeable context block.
export function renderContext(chunks: RetrievedChunk[]): string {
  return chunks
    .map(
      (c, i) =>
        `[${i + 1}] (${c.source}/${c.type} @ ${new Date(
          c.occurred_at
        ).toISOString().slice(0, 10)}, id=${c.event_id})\n${c.content}`
    )
    .join("\n\n");
}
