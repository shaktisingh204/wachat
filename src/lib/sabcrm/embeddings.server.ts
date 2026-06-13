import 'server-only';

/**
 * SabCRM — in-house semantic embeddings (server-only).
 *
 * Stores one vector per record in a dedicated `sabcrm_embeddings` collection
 * (NEVER on `sabcrm_records` — keeps reads light, the Rust DTO clean, and never
 * bumps a record's `updatedAt`). Retrieval is OUR OWN in-app cosine over the
 * stored vectors (`./vector-index.ts`) — no third-party vector DB. If scale
 * ever demands it, a custom in-house ANN index can replace the scan behind the
 * same `semanticSearch` shape.
 *
 * Two safety/cost guardrails are load-bearing:
 *  1. **Opt-in** — indexing only runs for projects that already hold ≥1 vector
 *     (seeded via `reindexAllProjectEmbeddings`), so no project pays embedding
 *     cost until it explicitly enables semantic search.
 *  2. **ACL re-apply** — the cosine scan is scoped only by `{projectId}`, so
 *     `semanticSearch` HYDRATES every candidate through the owner-scoped
 *     `getRecord(projectId, userId, id)` and drops anything the caller can't
 *     see (the per-user visibility lives there, not on the vectors).
 *
 * Everything degrades honestly: no embedding provider key → `embedText` returns
 * `null` → indexing is a no-op and `semanticSearch` returns `null` so callers
 * fall back to the keyword RAG. Never throws into a record mutation.
 */

import { createHash } from 'crypto';
import { ObjectId, type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getRecord } from './records.server';
import { recordText, type RagCandidate } from './crm-rag';
import { topKByCosine } from './vector-index';

/** Embedding model — gateway slug + direct API id resolve to the same space. */
export const GATEWAY_EMBED_MODEL = 'openai/text-embedding-3-small';
export const OPENAI_EMBED_MODEL = 'text-embedding-3-small';
/** Pinned alongside every vector; cosine never compares across dims. */
export const EMBED_DIM = 1536;

const EMB_COLL = 'sabcrm_embeddings';
const RECORDS_COLL = 'sabcrm_records';
const MAX_RECORDS_PER_SWEEP = 1000;
const DEFAULT_MAX_SCAN = 2000;

interface SabcrmEmbeddingDoc {
  _id: ObjectId;
  projectId: string;
  object: string;
  recordId: string;
  dim: number;
  vector: number[];
  model: string;
  textHash: string;
  updatedAt: string;
}

let _indexEnsured = false;
async function embCollection(db: Db) {
  const col = db.collection<SabcrmEmbeddingDoc>(EMB_COLL);
  if (!_indexEnsured) {
    _indexEnsured = true;
    try {
      await col.createIndex({ projectId: 1, object: 1, recordId: 1 }, { unique: true });
      await col.createIndex({ projectId: 1, object: 1 });
    } catch {
      /* best-effort — a missing index only slows the capped scan */
    }
  }
  return col;
}

/* -------------------------------------------------------------------------- */
/* Embedding provider ladder (gateway → OpenAI → null). Never throws.          */
/* -------------------------------------------------------------------------- */

export async function embedText(
  text: string,
  opts?: { maxRetries?: number },
): Promise<number[] | null> {
  const clean = (text || '').trim();
  if (!clean) return null;
  try {
    const gw = process.env.AI_GATEWAY_API_KEY ?? process.env.VERCEL_OIDC_TOKEN;
    if (gw) {
      const { embed } = await import('ai');
      const { embedding } = await embed({
        model: GATEWAY_EMBED_MODEL,
        value: clean,
        maxRetries: opts?.maxRetries ?? 0,
      });
      return Array.isArray(embedding) && embedding.length === EMBED_DIM ? embedding : null;
    }
    const oa = process.env.OPENAI_API_KEY;
    if (oa) {
      const res = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${oa}` },
        body: JSON.stringify({ model: OPENAI_EMBED_MODEL, input: clean.replace(/\n/g, ' ') }),
      });
      if (!res.ok) return null;
      const j = (await res.json()) as { data?: Array<{ embedding?: number[] }> };
      const v = j.data?.[0]?.embedding;
      return Array.isArray(v) && v.length === EMBED_DIM ? v : null;
    }
    return null;
  } catch {
    return null;
  }
}

function embedInputsHash(text: string, model: string): string {
  return createHash('sha256')
    .update(JSON.stringify({ text, model }))
    .digest('hex')
    .slice(0, 32);
}

/** Cheap best-effort label from common name fields (avoids a metadata read). */
function deriveLabel(data: Record<string, unknown>): string {
  const s = (v: unknown): string =>
    typeof v === 'string' ? v : typeof v === 'number' ? String(v) : '';
  const name = s(data.name) || s(data.title);
  if (name) return name;
  const full = [s(data.firstName), s(data.lastName)].filter(Boolean).join(' ');
  if (full) return full;
  return s(data.email) || s(data.label) || '';
}

/* -------------------------------------------------------------------------- */
/* Opt-in guard                                                                */
/* -------------------------------------------------------------------------- */

/** True once a project has been seeded (≥1 vector). Indexing is opt-in. */
export async function projectHasEmbeddings(projectId: string): Promise<boolean> {
  try {
    if (!projectId) return false;
    const { db } = await connectToDatabase();
    const col = await embCollection(db);
    return (await col.findOne({ projectId }, { projection: { _id: 1 } })) !== null;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Index a single record                                                       */
/* -------------------------------------------------------------------------- */

interface IndexOpts {
  /** Skip the opt-in guard (used by the seed/backfill sweep). */
  force?: boolean;
}

export async function indexEmbeddingForRecord(
  projectId: string,
  objectSlug: string,
  recordId: string,
  opts?: IndexOpts,
): Promise<boolean> {
  try {
    if (!projectId || !objectSlug || !recordId || !ObjectId.isValid(recordId)) {
      return false;
    }
    // Opt-in: don't embed for projects that never enabled semantic search.
    if (!opts?.force && !(await projectHasEmbeddings(projectId))) return false;

    const { db } = await connectToDatabase();
    const rec = (await db
      .collection(RECORDS_COLL)
      .findOne({ _id: new ObjectId(recordId), projectId })) as {
      data?: Record<string, unknown>;
      deletedAt?: unknown;
    } | null;
    if (!rec || rec.deletedAt) return false;

    const data = rec.data ?? {};
    const candidate: RagCandidate = {
      id: recordId,
      object: objectSlug,
      label: deriveLabel(data),
      data,
    };
    const text = recordText(candidate, true);
    if (!text.trim()) return false;
    const hash = embedInputsHash(text, OPENAI_EMBED_MODEL);

    const col = await embCollection(db);
    const existing = await col.findOne({ projectId, object: objectSlug, recordId });
    if (
      existing &&
      existing.textHash === hash &&
      existing.model === OPENAI_EMBED_MODEL &&
      existing.dim === EMBED_DIM
    ) {
      return false; // in sync — zero embedding API call
    }

    const vector = await embedText(text);
    if (!vector) return false; // unconfigured / failed → skip (keyword still works)

    await col.updateOne(
      { projectId, object: objectSlug, recordId },
      {
        $set: {
          projectId,
          object: objectSlug,
          recordId,
          dim: EMBED_DIM,
          vector,
          model: OPENAI_EMBED_MODEL,
          textHash: hash,
          updatedAt: new Date().toISOString(),
        },
      },
      { upsert: true },
    );
    return true;
  } catch {
    return false;
  }
}

export async function deleteEmbeddingForRecord(
  projectId: string,
  objectSlug: string,
  recordId: string,
): Promise<boolean> {
  try {
    if (!projectId || !objectSlug || !recordId) return false;
    const { db } = await connectToDatabase();
    const col = await embCollection(db);
    const res = await col.deleteOne({ projectId, object: objectSlug, recordId });
    return res.deletedCount > 0;
  } catch {
    return false;
  }
}

/* -------------------------------------------------------------------------- */
/* Sweeps (seed + backstop)                                                    */
/* -------------------------------------------------------------------------- */

/** (Re)index up to `limit` live records of an object. `force` seeds a cold project. */
export async function reindexEmbeddingsForObject(
  projectId: string,
  objectSlug: string,
  limit = MAX_RECORDS_PER_SWEEP,
  opts?: IndexOpts,
): Promise<{ scanned: number; updated: number }> {
  try {
    if (!projectId || !objectSlug) return { scanned: 0, updated: 0 };
    const { db } = await connectToDatabase();
    const recs = (await db
      .collection(RECORDS_COLL)
      .find({ projectId, object: objectSlug, deletedAt: { $in: [null] } })
      .project({ _id: 1 })
      .limit(Math.min(limit, MAX_RECORDS_PER_SWEEP))
      .toArray()) as Array<{ _id: ObjectId }>;
    let updated = 0;
    for (const r of recs) {
      if (await indexEmbeddingForRecord(projectId, objectSlug, r._id.toHexString(), opts)) {
        updated += 1;
      }
    }
    return { scanned: recs.length, updated };
  } catch {
    return { scanned: 0, updated: 0 };
  }
}

/** Re-index every object of a project. `force` for the initial seed/backfill. */
export async function reindexAllProjectEmbeddings(
  projectId: string,
  perObjectLimit = 500,
  opts?: IndexOpts,
): Promise<Array<{ objectSlug: string; scanned: number; updated: number }>> {
  const out: Array<{ objectSlug: string; scanned: number; updated: number }> = [];
  try {
    const { listObjects } = await import('./objects.server');
    const objects = await listObjects(projectId);
    for (const obj of objects) {
      out.push({
        objectSlug: obj.slug,
        ...(await reindexEmbeddingsForObject(projectId, obj.slug, perObjectLimit, opts)),
      });
    }
  } catch {
    /* best-effort */
  }
  return out;
}

/** Projects that have opted into semantic search (≥1 vector). Backstop scope. */
export async function listProjectsWithEmbeddings(db: Db): Promise<string[]> {
  try {
    const ids = (await db.collection(EMB_COLL).distinct('projectId')) as string[];
    return ids.filter(Boolean);
  } catch {
    return [];
  }
}

/* -------------------------------------------------------------------------- */
/* Semantic retrieval (ACL-hydrated)                                           */
/* -------------------------------------------------------------------------- */

/**
 * Embed the query, cosine-rank stored vectors (scoped by projectId + dim +
 * model), then HYDRATE candidates through the owner-scoped `getRecord` so the
 * caller only ever grounds on records they can see. Returns `null` when
 * embeddings are unavailable (→ caller falls back to keyword); `[]` is a valid
 * "no semantic match" that the caller also treats as a fallback trigger.
 */
export async function semanticSearch(
  projectId: string,
  userId: string,
  query: string,
  opts?: { objects?: string[]; topK?: number; maxScan?: number },
): Promise<RagCandidate[] | null> {
  const qv = await embedText(query, { maxRetries: 2 });
  if (!qv) return null;
  try {
    const topK = opts?.topK ?? 12;
    // Our own vector store: brute-force cosine over the Mongo-stored vectors.
    const { db } = await connectToDatabase();
    const col = await embCollection(db);
    const filter: Record<string, unknown> = {
      projectId,
      dim: EMBED_DIM,
      model: OPENAI_EMBED_MODEL,
    };
    if (opts?.objects?.length) filter.object = { $in: opts.objects };
    const rows = (await col
      .find(filter)
      .project({ recordId: 1, object: 1, vector: 1, dim: 1 })
      .limit(opts?.maxScan ?? DEFAULT_MAX_SCAN)
      .toArray()) as unknown as Array<{
      recordId: string;
      object: string;
      vector: number[];
      dim: number;
    }>;
    const ranked = topKByCosine(qv, rows, topK * 4, EMBED_DIM); // over-fetch for the ACL pass

    // ACL re-apply: drop anything the caller can't see via the owner-scoped read.
    const visible: RagCandidate[] = [];
    for (const r of ranked) {
      if (visible.length >= topK) break;
      const rec = await getRecord(projectId, userId, r.recordId);
      if (!rec) continue; // not visible / deleted ghost
      visible.push({ id: rec._id, object: rec.object, label: rec.label, data: rec.data ?? {} });
    }
    return visible;
  } catch {
    return null;
  }
}
