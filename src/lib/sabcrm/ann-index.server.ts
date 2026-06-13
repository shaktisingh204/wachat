import 'server-only';

/**
 * SabCRM — opt-in ANN (LSH) retrieval path for semantic search (server-only).
 *
 * The default `embeddings.server.semanticSearch` brute-forces cosine over every
 * stored vector. That's fine for small corpora but O(N·dim) per query. Above a
 * corpus-size threshold this module answers the SAME query shape with our
 * in-house random-hyperplane LSH index (`./ann-lsh.ts`) — probe a few buckets,
 * exact-cosine rerank the candidates — then re-applies the IDENTICAL ACL
 * hydration `semanticSearch` uses, so it can never leak a record the caller
 * can't see.
 *
 * It is OUR OWN vector store throughout: Mongo for the vectors, in-app math for
 * the index. No third-party vector DB. No LLM call here (the query is already an
 * embedding when this is invoked from the search path; if a raw query string is
 * passed we embed it via the existing `embedText` ladder — embedding cost
 * unchanged from the brute-force path).
 *
 * Two load-bearing properties:
 *  1. **Memoization** — building the LSH index is the expensive step. We cache
 *     one index per project keyed on the SET of stored `textHash`es (a stable
 *     fingerprint of the corpus). Any add/remove/re-embed changes a hash and
 *     invalidates the cache, so a stale index is never served. The cache is a
 *     small bounded LRU so a busy multi-project box doesn't grow unbounded.
 *  2. **ACL re-apply** — same as `semanticSearch`: the index scan is scoped only
 *     by `{projectId}`, so every candidate is HYDRATED through the owner-scoped
 *     `getRecord(projectId, userId, id)` and dropped if the caller can't see it.
 *
 * Degrades honestly: no embeddings / build failure / no provider key → returns
 * `null` so the caller falls back to brute-force (or keyword) retrieval.
 */

import { createHash } from 'crypto';
import { type Db } from 'mongodb';

import { connectToDatabase } from '@/lib/mongodb';
import { getRecord } from './records.server';
import type { RagCandidate } from './crm-rag';
import { topKByCosine } from './vector-index';
import { buildLshIndex, queryLsh, type LshIndex, type LshRow } from './ann-lsh';
import {
  embedText,
  EMBED_DIM,
  OPENAI_EMBED_MODEL,
} from './embeddings.server';

const EMB_COLL = 'sabcrm_embeddings';

/**
 * Corpus-size threshold: at/above this many stored vectors the ANN path is
 * worth its build cost; below it, brute-force is both faster and exact, so the
 * caller should keep using `topKByCosine`. Exposed so the search path can make
 * the same decision before invoking this module.
 */
export const ANN_MIN_CORPUS = 2000;

/** LSH tuning. 16 planes → 65k buckets max; good recall at 1536-dim. */
const LSH_NUM_PLANES = 16;
const LSH_SEED = 1469; // fixed → deterministic index across rebuilds
const LSH_MAX_HAMMING = 4;
const LSH_MIN_CANDIDATES = 64;
/** Hard cap on rows pulled into an in-memory index (matches search maxScan). */
const MAX_INDEX_ROWS = 50_000;
/** Bounded LRU of built indexes across projects. */
const INDEX_CACHE_LIMIT = 8;

interface EmbRow {
  recordId: string;
  object: string;
  vector: number[];
  dim: number;
  textHash: string;
}

interface CachedIndex {
  fingerprint: string;
  objectsKey: string;
  index: LshIndex;
}

/** Simple insertion-ordered LRU (Map preserves insertion order). */
const _cache = new Map<string, CachedIndex>();

function cacheGet(projectId: string): CachedIndex | undefined {
  const hit = _cache.get(projectId);
  if (hit) {
    // touch → move to most-recent.
    _cache.delete(projectId);
    _cache.set(projectId, hit);
  }
  return hit;
}

function cacheSet(projectId: string, entry: CachedIndex): void {
  if (_cache.has(projectId)) _cache.delete(projectId);
  _cache.set(projectId, entry);
  while (_cache.size > INDEX_CACHE_LIMIT) {
    const oldest = _cache.keys().next().value as string | undefined;
    if (oldest === undefined) break;
    _cache.delete(oldest);
  }
}

/** Test/admin hook: drop a project's (or all) cached index. */
export function clearAnnIndexCache(projectId?: string): void {
  if (projectId) _cache.delete(projectId);
  else _cache.clear();
}

/**
 * Stable fingerprint of the corpus: a hash of the sorted `textHash` set. Any
 * vector add / delete / re-embed flips at least one textHash and therefore this
 * fingerprint, invalidating the memoized index. Order-independent (sorted).
 */
function corpusFingerprint(rows: EmbRow[]): string {
  const hashes = rows.map((r) => r.textHash).sort();
  return createHash('sha256').update(hashes.join('|')).digest('hex').slice(0, 32);
}

async function loadRows(
  db: Db,
  projectId: string,
  objects?: string[],
): Promise<EmbRow[]> {
  const filter: Record<string, unknown> = {
    projectId,
    dim: EMBED_DIM,
    model: OPENAI_EMBED_MODEL,
  };
  if (objects?.length) filter.object = { $in: objects };
  const docs = (await db
    .collection(EMB_COLL)
    .find(filter)
    .project({ recordId: 1, object: 1, vector: 1, dim: 1, textHash: 1 })
    .limit(MAX_INDEX_ROWS)
    .toArray()) as unknown as EmbRow[];
  return docs;
}

/**
 * Build (or fetch from cache) the project's LSH index. The cache key is
 * `(projectId)`; an entry is reused only when BOTH the corpus fingerprint AND
 * the object-scope match, so an object-filtered query never serves a full-corpus
 * index (which could surface out-of-scope objects to the reranker).
 */
function ensureIndex(
  projectId: string,
  rows: EmbRow[],
  objectsKey: string,
): LshIndex {
  const fingerprint = corpusFingerprint(rows);
  const cached = cacheGet(projectId);
  if (cached && cached.fingerprint === fingerprint && cached.objectsKey === objectsKey) {
    return cached.index;
  }
  const lshRows: LshRow[] = rows.map((r) => ({
    recordId: r.recordId,
    object: r.object,
    vector: r.vector,
    dim: r.dim,
  }));
  const index = buildLshIndex(lshRows, { numPlanes: LSH_NUM_PLANES, seed: LSH_SEED });
  cacheSet(projectId, { fingerprint, objectsKey, index });
  return index;
}

export interface AnnSearchOpts {
  objects?: string[];
  topK?: number;
  /** Force the ANN path regardless of corpus size (tests / explicit opt-in). */
  force?: boolean;
}

/**
 * ANN-backed semantic search. Mirrors `embeddings.server.semanticSearch`:
 *  - `query` may be a string (embedded via the existing ladder) OR a
 *    pre-computed query vector (no embedding cost — the search path already has
 *    one).
 *  - ACL hydration is byte-identical to `semanticSearch`.
 *
 * Returns `null` to signal "use the brute-force / keyword fallback" when:
 *  - the query can't be embedded, or
 *  - the corpus is below {@link ANN_MIN_CORPUS} and `force` isn't set, or
 *  - anything throws.
 * Returns `[]` for a genuine "no semantic match" (a valid fallback trigger for
 * the caller, same contract as `semanticSearch`).
 */
export async function annSemanticSearch(
  projectId: string,
  userId: string,
  query: string | number[],
  opts?: AnnSearchOpts,
): Promise<RagCandidate[] | null> {
  try {
    const topK = opts?.topK ?? 12;

    // Resolve the query vector (string → embed via the shared ladder).
    let qv: number[] | null;
    if (Array.isArray(query)) {
      qv = query.length === EMBED_DIM ? query : null;
    } else {
      qv = await embedText(query, { maxRetries: 2 });
    }
    if (!qv) return null;

    const { db } = await connectToDatabase();
    const rows = await loadRows(db, projectId, opts?.objects);

    // Below threshold → brute-force is faster + exact; let the caller fall back.
    if (!opts?.force && rows.length < ANN_MIN_CORPUS) return null;
    if (rows.length === 0) return [];

    const objectsKey = opts?.objects?.length
      ? [...opts.objects].sort().join(',')
      : '*';
    const index = ensureIndex(projectId, rows, objectsKey);

    // ANN probe + exact-cosine rerank (over-fetch for the ACL pass). If the
    // index degenerated (e.g. all wrong-dim) fall back to a brute-force scan of
    // the loaded rows so we never silently return nothing on a real corpus.
    let ranked = queryLsh(index, qv, topK * 4, {
      maxHamming: LSH_MAX_HAMMING,
      minCandidates: LSH_MIN_CANDIDATES,
    });
    if (ranked.length === 0 && index.rows.length === 0) {
      ranked = topKByCosine(
        qv,
        rows.map((r) => ({
          recordId: r.recordId,
          object: r.object,
          vector: r.vector,
          dim: r.dim,
        })),
        topK * 4,
        EMBED_DIM,
      );
    }

    // ACL re-apply — IDENTICAL to semanticSearch: owner-scoped hydration.
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
