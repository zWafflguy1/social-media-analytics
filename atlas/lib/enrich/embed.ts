import { createHash } from "node:crypto";

const DIM = 1536;

/**
 * Embeddings provider. Atlas ships with a deterministic local embedder so the
 * whole system runs with zero external embedding dependency (good for dev,
 * tests, and demos). Set ATLAS_EMBEDDING_PROVIDER=voyage in production for
 * semantically meaningful vectors.
 */
export async function embed(text: string): Promise<number[]> {
  const provider = process.env.ATLAS_EMBEDDING_PROVIDER || "local";
  if (provider === "voyage") return embedVoyage(text);
  return embedLocal(text);
}

// Hashed bag-of-words projected into DIM dims, L2-normalized. Not semantic, but
// stable and dependency-free — lets the pipeline run end to end anywhere.
function embedLocal(text: string): number[] {
  const vec = new Array<number>(DIM).fill(0);
  const tokens = text.toLowerCase().match(/[a-z0-9]+/g) ?? [];
  for (const tok of tokens) {
    const h = createHash("md5").update(tok).digest();
    const idx = h.readUInt32LE(0) % DIM;
    const sign = h[4] % 2 === 0 ? 1 : -1;
    vec[idx] += sign;
  }
  const norm = Math.sqrt(vec.reduce((s, x) => s + x * x, 0)) || 1;
  return vec.map((x) => x / norm);
}

async function embedVoyage(text: string): Promise<number[]> {
  const key = process.env.VOYAGE_API_KEY;
  if (!key) throw new Error("VOYAGE_API_KEY required for voyage embeddings");
  const res = await fetch("https://api.voyageai.com/v1/embeddings", {
    method: "POST",
    headers: { "content-type": "application/json", authorization: `Bearer ${key}` },
    body: JSON.stringify({ model: "voyage-3", input: text, output_dimension: DIM }),
  });
  if (!res.ok) throw new Error(`voyage embeddings failed: ${res.status}`);
  const json = (await res.json()) as { data: { embedding: number[] }[] };
  return json.data[0].embedding;
}
