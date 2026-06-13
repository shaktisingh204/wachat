/**
 * SabCRM — pure vector math for in-app semantic retrieval.
 *
 * `'server-only'`- and I/O-free (unit-testable), and intentionally dependency
 * free (no `ai` SDK import) so the worker/cron bundle and the tests stay light.
 * Cosine + brute-force top-K is the only algorithm — our own vector search, no
 * third-party vector DB. If scale ever demands it, a custom in-house ANN index
 * (HNSW/LSH in TS) can replace the scan behind this same shape.
 */

export interface ScoredId {
  recordId: string;
  object: string;
  score: number;
}

/** Cosine similarity in [-1, 1]. Returns 0 on dim mismatch or a zero vector. */
export function cosineSim(a: number[], b: number[]): number {
  if (!a || !b || a.length === 0 || a.length !== b.length) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  if (na === 0 || nb === 0) return 0;
  return dot / (Math.sqrt(na) * Math.sqrt(nb));
}

/**
 * Brute-force top-K by cosine. `dim` filters incompatible vectors BEFORE
 * scoring so vectors from a different embedding model/space are never compared.
 * Only positive-similarity matches are kept, highest first.
 */
export function topKByCosine(
  query: number[],
  rows: Array<{ recordId: string; object: string; vector: number[]; dim: number }>,
  topK = 12,
  dim = query.length,
): ScoredId[] {
  const out: ScoredId[] = [];
  for (const r of rows) {
    if (r.dim !== dim || !r.vector || r.vector.length !== dim) continue;
    const score = cosineSim(query, r.vector);
    if (score > 0) out.push({ recordId: r.recordId, object: r.object, score });
  }
  out.sort((x, y) => y.score - x.score);
  return out.slice(0, Math.max(1, topK));
}
