import { complete } from "../anthropic";
import { audit } from "../audit";
import { retrieve, renderContext, type RetrievedChunk } from "../knowledge/retrieve";

export interface AnswerResult {
  answer: string;
  citations: { ref: number; event_id: string; source: string }[];
}

const SYSTEM = `You are Atlas, the institutional memory of a business. Answer the
user's question using ONLY the provided context drawn from the company's own
calls, emails, decisions, and metrics. Rules:
- Ground every claim in the context. If the context doesn't answer it, say so plainly.
- Cite sources inline using the bracket numbers, e.g. [2].
- Be concise and direct. Surface the most decision-relevant facts first.
- Never invent names, numbers, or events that aren't in the context.`;

/** Ask-anything over the tenant's knowledge. Tier-0, read-only. */
export async function ask(tenantId: string, question: string): Promise<AnswerResult> {
  const chunks = await retrieve(tenantId, question, 8);
  const context = chunks.length
    ? renderContext(chunks)
    : "(no relevant records found)";

  const answer = await complete(
    `Question: ${question}\n\nContext:\n${context}`,
    { tier: "fast", system: SYSTEM, cacheSystem: true, maxTokens: 1200 }
  );

  await audit(tenantId, "agent", "chat.answered", undefined, {
    question: question.slice(0, 200),
    chunks: chunks.length,
  });

  return { answer, citations: toCitations(chunks) };
}

function toCitations(chunks: RetrievedChunk[]) {
  return chunks.map((c, i) => ({
    ref: i + 1,
    event_id: c.event_id,
    source: c.source,
  }));
}
