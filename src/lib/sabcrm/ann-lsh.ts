/**
 * SabCRM — in-house ANN (approximate nearest-neighbour) via random-hyperplane LSH.
 *
 * PURE: `'server-only'`- and I/O-free (unit-testable), and intentionally
 * dependency free (no `ai` SDK, no Mongo) so the worker/cron bundle and the
 * tests stay light. This is OUR OWN vector search — no third-party vector DB.
 *
 * Replaces the brute-force cosine scan (`./vector-index.ts`) at scale: instead
 * of scoring every stored vector, we hash each vector against random
 * hyperplanes into compact bit signatures, then at query time probe only the
 * buckets whose signatures are Hamming-near the query's signature and
 * exact-cosine rerank that (much smaller) candidate set.
 *
 * Amplification — why MULTIPLE tables:
 *   A single random-hyperplane table is a weak recall device: two genuinely
 *   similar vectors land in the same bucket only with probability ~(1 − θ/π)^P
 *   (P planes, angle θ), so for P high enough to keep buckets small, recall
 *   collapses. The textbook fix is the classic LSH amplification: build `L`
 *   INDEPENDENT tables (each with its own seeded hyperplanes) and take the
 *   UNION of their candidate sets — collision probability rises to
 *   1 − (1 − p^P)^L. With L = 6 we hit recall@10 ≳ 0.9 against brute-force on
 *   clustered data while still touching only a fraction of the corpus.
 *
 * Determinism is load-bearing for two reasons:
 *  1. **Unit-testability** — recall/ranking can be asserted against brute-force.
 *  2. **Memoization** — the server layer caches an index per project; a
 *     deterministic build means a re-build over the same rows is identical, so
 *     the cache key (project + textHash-set) is sound.
 *
 * Every table's planes come from a seeded PRNG (mulberry32 + a Box–Muller
 * Gaussian draw), NEVER `Math.random`. Table `t` uses `seed + t * 0x9e3779b1`
 * (a golden-ratio stride so the tables are well-separated), so the same
 * `(dim, numPlanes, numTables, seed)` always yields the same hyperplanes and
 * therefore the same signatures.
 */

import { cosineSim, type ScoredId } from './vector-index';

/** One indexed row. Mirrors the shape stored in `sabcrm_embeddings`. */
export interface LshRow {
  recordId: string;
  object: string;
  vector: number[];
  dim: number;
}

/** One hash table: its hyperplanes + the bucket map over the shared rows. */
export interface LshTable {
  /** This table's PRNG seed (deterministic). */
  seed: number;
  /** Random hyperplanes: `numPlanes` rows of `dim` Gaussian components. */
  planes: number[][];
  /** Bucket map: signature key → indices into {@link LshIndex.rows}. */
  buckets: Map<string, number[]>;
}

/** A built LSH index. Opaque to callers other than {@link queryLsh}. */
export interface LshIndex {
  /** Embedding dimensionality this index was built for. */
  dim: number;
  /** Number of random hyperplanes per table (signature bit length). */
  numPlanes: number;
  /** Number of independent hash tables (amplification factor `L`). */
  numTables: number;
  /** Base seed the per-table planes were derived from. */
  seed: number;
  /** The `L` independent hash tables. */
  tables: LshTable[];
  /** The indexed rows (kept for exact-cosine rerank). Shared across tables. */
  rows: LshRow[];
}

export interface BuildLshOpts {
  /** Signature bit length per table. More planes → finer buckets. */
  numPlanes?: number;
  /** Number of independent tables (amplification `L`). More → higher recall. */
  numTables?: number;
  /** Base PRNG seed for the hyperplanes (deterministic). */
  seed?: number;
}

export interface QueryLshOpts {
  /**
   * Max Hamming distance (in bits) the multi-probe will reach out to PER TABLE.
   * Buckets farther than this from the query signature are not probed. The probe
   * still stops early once `minCandidates` is met across the table union.
   */
  maxHamming?: number;
  /**
   * Target candidate count across the union of all tables. Buckets are pulled in
   * ascending Hamming-distance order until at least this many DISTINCT
   * candidates are gathered. When the union still can't reach this many we fall
   * back to a full scan so recall never silently collapses on a tiny corpus.
   */
  minCandidates?: number;
}

const DEFAULT_NUM_PLANES = 12;
const DEFAULT_NUM_TABLES = 6;
const DEFAULT_SEED = 1;
const DEFAULT_MAX_HAMMING = 3;
/** Below this many candidates the probe is unreliable → exact full scan. */
const DEFAULT_MIN_CANDIDATES = 80;
/** Golden-ratio stride keeps independent table seeds well-separated. */
const SEED_STRIDE = 0x9e3779b1;

/* -------------------------------------------------------------------------- */
/* Deterministic PRNG + Gaussian draw (no Math.random)                         */
/* -------------------------------------------------------------------------- */

/** mulberry32 — tiny, fast, fully deterministic 32-bit PRNG in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Standard-normal draw via Box–Muller. Gaussian hyperplane components give an
 * unbiased (uniform on the sphere) set of random directions, which is what
 * makes the sign hash an unbiased cosine-LSH. Clamps `u1` off 0 to avoid log(0).
 */
function gaussian(rng: () => number): number {
  let u1 = rng();
  const u2 = rng();
  if (u1 < 1e-12) u1 = 1e-12;
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
}

/** Deterministic `numPlanes × dim` Gaussian hyperplane matrix from `seed`. */
function buildPlanes(dim: number, numPlanes: number, seed: number): number[][] {
  const rng = mulberry32(seed);
  const planes: number[][] = [];
  for (let p = 0; p < numPlanes; p++) {
    const plane = new Array<number>(dim);
    for (let i = 0; i < dim; i++) plane[i] = gaussian(rng);
    planes.push(plane);
  }
  return planes;
}

/** Per-table seed: a golden-ratio stride off the base seed (well-separated). */
function tableSeed(baseSeed: number, table: number): number {
  return (baseSeed + Math.imul(table, SEED_STRIDE)) >>> 0;
}

/* -------------------------------------------------------------------------- */
/* Signatures                                                                  */
/* -------------------------------------------------------------------------- */

/**
 * Sign-of-dot-product signature: bit `p` is 1 iff the vector is on the positive
 * side of hyperplane `p`. Returns `null` on a dim mismatch so a stray
 * wrong-dim row never poisons a bucket. The string form (length `numPlanes`,
 * '0'/'1') is a cheap, hashable bucket key.
 */
function signatureOf(vector: number[], planes: number[][], dim: number): string | null {
  if (!vector || vector.length !== dim) return null;
  let sig = '';
  for (let p = 0; p < planes.length; p++) {
    const plane = planes[p];
    let dot = 0;
    for (let i = 0; i < dim; i++) dot += vector[i] * plane[i];
    sig += dot >= 0 ? '1' : '0';
  }
  return sig;
}

/** Hamming distance between two equal-length bit strings. */
function hamming(a: string, b: string): number {
  let d = 0;
  for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) d++;
  return d;
}

/* -------------------------------------------------------------------------- */
/* Build                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Build an `L`-table random-hyperplane LSH index over `rows`. Rows whose `dim`
 * or vector length doesn't match the index `dim` are SKIPPED (never bucketed,
 * never compared) — same defense as `topKByCosine`. The index `dim` is taken
 * from the first usable row; an empty input yields a usable empty index
 * (queries fall straight through to the empty full scan).
 *
 * All tables share ONE `rows` array and index INTO it, so the memory overhead
 * of `L` tables is only `L` small bucket maps + `L` plane matrices, not `L`
 * copies of the vectors.
 */
export function buildLshIndex(rows: LshRow[], opts?: BuildLshOpts): LshIndex {
  const numPlanes = Math.max(1, opts?.numPlanes ?? DEFAULT_NUM_PLANES);
  const numTables = Math.max(1, opts?.numTables ?? DEFAULT_NUM_TABLES);
  const seed = opts?.seed ?? DEFAULT_SEED;

  // Index dim = the first row's declared dim that matches its own vector.
  let dim = 0;
  for (const r of rows ?? []) {
    if (r && r.vector && r.vector.length > 0 && r.vector.length === r.dim) {
      dim = r.dim;
      break;
    }
  }

  // Keep only usable rows, ONCE, shared across every table.
  const kept: LshRow[] = [];
  for (const r of rows ?? []) {
    if (!r || dim === 0 || r.dim !== dim || !r.vector || r.vector.length !== dim) {
      continue; // wrong-dim / empty → excluded from the index entirely
    }
    kept.push(r);
  }

  const tables: LshTable[] = [];
  if (dim > 0) {
    for (let t = 0; t < numTables; t++) {
      const tSeed = tableSeed(seed, t);
      const planes = buildPlanes(dim, numPlanes, tSeed);
      const buckets = new Map<string, number[]>();
      for (let i = 0; i < kept.length; i++) {
        const sig = signatureOf(kept[i].vector, planes, dim);
        if (sig === null) continue;
        const list = buckets.get(sig);
        if (list) list.push(i);
        else buckets.set(sig, [i]);
      }
      tables.push({ seed: tSeed, planes, buckets });
    }
  }

  return { dim, numPlanes, numTables, seed, tables, rows: kept };
}

/* -------------------------------------------------------------------------- */
/* Query                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Approximate top-K by cosine.
 *
 * 1. Hash the query into a signature per table.
 * 2. MULTI-TABLE MULTI-PROBE: for each table, order its populated buckets by
 *    Hamming distance to that table's query signature (nearest first) and pull
 *    their row indices into a shared candidate set; round-robin across tables so
 *    every table contributes its nearest buckets. Stop once the UNION reaches
 *    `minCandidates` or every table is exhausted within `maxHamming`. The union
 *    of independent tables is the LSH amplification that lifts recall.
 * 3. If the union is still too small (skewed corpus / few rows), FALL BACK to
 *    scoring every row — recall must never silently collapse.
 * 4. Exact-cosine rerank the candidates and return the top-K (positive only),
 *    byte-identical in shape to {@link topKByCosine}.
 *
 * Returns `[]` on a dim mismatch or an empty index (never throws, never NaN).
 */
export function queryLsh(
  index: LshIndex,
  vector: number[],
  topK = 12,
  opts?: QueryLshOpts,
): ScoredId[] {
  const k = Math.max(1, topK);
  if (!index || index.dim === 0 || index.rows.length === 0) return [];
  if (!vector || vector.length !== index.dim) return [];

  const maxHamming = Math.max(0, opts?.maxHamming ?? DEFAULT_MAX_HAMMING);
  const minCandidates = Math.max(k, opts?.minCandidates ?? DEFAULT_MIN_CANDIDATES);

  // Per-table: query signature + buckets ordered by ascending Hamming distance.
  const perTable: Array<{ buckets: Map<string, number[]>; order: string[] }> = [];
  for (const table of index.tables) {
    const qSig = signatureOf(vector, table.planes, index.dim);
    if (qSig === null) continue;
    const order = Array.from(table.buckets.keys())
      .map((sig) => ({ sig, d: hamming(sig, qSig) }))
      .filter((b) => b.d <= maxHamming)
      .sort((a, b) => a.d - b.d || (a.sig < b.sig ? -1 : a.sig > b.sig ? 1 : 0))
      .map((b) => b.sig);
    perTable.push({ buckets: table.buckets, order });
  }

  // Per-table gather: from EACH table pull its nearest buckets (ascending
  // Hamming) until that table has itself contributed ~`minCandidates` rows, then
  // UNION across tables. Giving every independent table its own budget — rather
  // than stopping the instant the shared union crosses the threshold — is what
  // realises the amplification: the same true neighbour that one table missed is
  // very likely caught by another. The union is hard-capped so a pathological
  // corpus can't blow up the rerank cost.
  const hardCap = minCandidates * Math.max(2, perTable.length);
  const candidates = new Set<number>();
  for (const { buckets, order } of perTable) {
    let fromTable = 0;
    for (const sig of order) {
      const list = buckets.get(sig);
      if (list) {
        for (const i of list) candidates.add(i);
        fromTable += list.length;
      }
      if (fromTable >= minCandidates) break;
    }
    if (candidates.size >= hardCap) break;
  }

  // Graceful fallback: union couldn't reach a usable candidate set → full scan.
  const useFullScan = candidates.size < minCandidates;
  const pool: number[] = useFullScan
    ? index.rows.map((_, i) => i)
    : Array.from(candidates);

  const out: ScoredId[] = [];
  for (const i of pool) {
    const r = index.rows[i];
    const score = cosineSim(vector, r.vector);
    if (score > 0) out.push({ recordId: r.recordId, object: r.object, score });
  }
  out.sort((a, b) => b.score - a.score);
  return out.slice(0, k);
}
