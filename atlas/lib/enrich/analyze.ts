import { completeJSON } from "../anthropic";

export interface EventAnalysis {
  summary: string;
  action_items: string[];
  sentiment: number; // -1..1
  urgency: number; // 0..1
  topics: string[];
  entities: { kind: string; name: string }[];
  // A decision the model believes was made in this event (optional).
  decision?: { title: string; rationale?: string } | null;
}

const SYSTEM = `You are the enrichment engine of a business knowledge layer.
Given one business event (a call transcript, email, CRM update, etc.), extract
structured knowledge. Be precise and conservative — do not invent facts.
Return ONLY a JSON object with this exact shape:
{
  "summary": "2-3 sentence neutral summary",
  "action_items": ["..."],
  "sentiment": -1.0 to 1.0,
  "urgency": 0.0 to 1.0,
  "topics": ["short topic tags"],
  "entities": [{"kind":"person|account|deal|campaign|quarter","name":"..."}],
  "decision": {"title":"...","rationale":"..."} or null
}`;

export async function analyzeEvent(input: {
  source: string;
  type: string;
  subject?: string | null;
  body?: string | null;
  actors: unknown;
}): Promise<EventAnalysis> {
  const prompt = `Event source: ${input.source}
Event type: ${input.type}
Subject: ${input.subject ?? "(none)"}
Actors: ${JSON.stringify(input.actors)}

Body:
"""
${(input.body ?? "").slice(0, 12000)}
"""`;

  const result = await completeJSON<EventAnalysis>(prompt, {
    tier: "fast",
    system: SYSTEM,
    cacheSystem: true, // stable instructions → cache across the whole corpus
    maxTokens: 1200,
  });

  // Defensive defaults — the pipeline must never crash on a sparse model reply.
  return {
    summary: result.summary ?? "",
    action_items: result.action_items ?? [],
    sentiment: clamp(result.sentiment ?? 0, -1, 1),
    urgency: clamp(result.urgency ?? 0, 0, 1),
    topics: result.topics ?? [],
    entities: result.entities ?? [],
    decision: result.decision ?? null,
  };
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n));
}
