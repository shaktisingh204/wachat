import 'server-only';

/**
 * SabCRM — Qdrant vector backend (server-only). [config-gated, default OFF]
 *
 * A drop-in alternative to the in-app Mongo+cosine retriever in
 * `./embeddings.server.ts`, for projects/deployments that scale past brute-force
 * cosine. Uses Qdrant's REST API over plain `fetch` (no new npm dependency).
 * ENABLED only when `QDRANT_URL` is set — otherwise every function is a no-op /
 * returns null so the Mongo path stays in effect. Best-effort; never throws.
 *
 * Auth: `QDRANT_API_KEY` (sent as the `api-key` header) when present.
 * Points carry `{ projectId, object, recordId }` payload so search can filter
 * by tenant + object exactly like the Mongo scan.
 */

const COLLECTION = 'sabcrm_records';

export function isQdrantEnabled(): boolean {
  return !!process.env.QDRANT_URL;
}

function base(): string {
  return (process.env.QDRANT_URL || '').replace(/\/+$/, '');
}

function headers(): Record<string, string> {
  const h: Record<string, string> = { 'content-type': 'application/json' };
  if (process.env.QDRANT_API_KEY) h['api-key'] = process.env.QDRANT_API_KEY;
  return h;
}

/** Deterministic point id from (projectId, object, recordId). */
function pointId(projectId: string, object: string, recordId: string): string {
  // Qdrant accepts a string id; keep it unique + stable per record.
  return `${projectId}:${object}:${recordId}`;
}

/** Idempotently create the collection with the given vector size + cosine. */
export async function ensureQdrantCollection(dim: number): Promise<boolean> {
  if (!isQdrantEnabled()) return false;
  try {
    const res = await fetch(`${base()}/collections/${COLLECTION}`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({ vectors: { size: dim, distance: 'Cosine' } }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Upsert one record's vector. */
export async function qdrantUpsert(
  projectId: string,
  object: string,
  recordId: string,
  vector: number[],
): Promise<boolean> {
  if (!isQdrantEnabled()) return false;
  try {
    const res = await fetch(`${base()}/collections/${COLLECTION}/points`, {
      method: 'PUT',
      headers: headers(),
      body: JSON.stringify({
        points: [
          { id: pointId(projectId, object, recordId), vector, payload: { projectId, object, recordId } },
        ],
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Delete one record's vector. */
export async function qdrantDelete(
  projectId: string,
  object: string,
  recordId: string,
): Promise<boolean> {
  if (!isQdrantEnabled()) return false;
  try {
    const res = await fetch(`${base()}/collections/${COLLECTION}/points/delete`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ points: [pointId(projectId, object, recordId)] }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export interface QdrantHit {
  recordId: string;
  object: string;
  score: number;
}

/**
 * Vector search scoped to a tenant (+ optional objects). Returns ranked hits,
 * or null when Qdrant is disabled / unreachable (→ caller falls back to Mongo).
 */
export async function qdrantSearch(
  projectId: string,
  vector: number[],
  topK: number,
  objects?: string[],
): Promise<QdrantHit[] | null> {
  if (!isQdrantEnabled()) return null;
  try {
    const must: Array<Record<string, unknown>> = [
      { key: 'projectId', match: { value: projectId } },
    ];
    if (objects?.length) must.push({ key: 'object', match: { any: objects } });
    const res = await fetch(`${base()}/collections/${COLLECTION}/points/search`, {
      method: 'POST',
      headers: headers(),
      body: JSON.stringify({ vector, limit: topK, with_payload: true, filter: { must } }),
    });
    if (!res.ok) return null;
    const j = (await res.json()) as {
      result?: Array<{ score?: number; payload?: { object?: string; recordId?: string } }>;
    };
    return (j.result ?? []).map((r) => ({
      recordId: String(r.payload?.recordId ?? ''),
      object: String(r.payload?.object ?? ''),
      score: typeof r.score === 'number' ? r.score : 0,
    }));
  } catch {
    return null;
  }
}
