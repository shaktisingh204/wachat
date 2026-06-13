/**
 * Unit tests for the pure ANN/LSH index (`../ann-lsh`).
 *   npx tsx --test src/lib/sabcrm/__tests__/ann-lsh.test.ts
 *
 * Asserts LSH recall against brute-force cosine (`../vector-index`), build
 * determinism, dim-mismatch safety, and empty/last-row edges. No I/O.
 */

import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { buildLshIndex, queryLsh, type LshRow } from '../ann-lsh';
import { topKByCosine } from '../vector-index';

/* -------------------------------------------------------------------------- */
/* Synthetic corpus: deterministic, no Math.random in the test either.         */
/* -------------------------------------------------------------------------- */

function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Build N rows of `dim` random unit-ish vectors clustered around a few seeds. */
function makeCorpus(n: number, dim: number, seed = 7): LshRow[] {
  const rng = prng(seed);
  // A handful of cluster centers so nearest-neighbours are meaningful.
  const numClusters = 8;
  const centers: number[][] = [];
  for (let c = 0; c < numClusters; c++) {
    const v = new Array<number>(dim);
    for (let i = 0; i < dim; i++) v[i] = rng() * 2 - 1;
    centers.push(v);
  }
  const rows: LshRow[] = [];
  for (let r = 0; r < n; r++) {
    const center = centers[r % numClusters];
    const v = new Array<number>(dim);
    for (let i = 0; i < dim; i++) v[i] = center[i] + (rng() * 0.4 - 0.2); // jitter
    rows.push({ recordId: `r${r}`, object: 'people', vector: v, dim });
  }
  return rows;
}

function makeQuery(dim: number, seed = 99): number[] {
  const rng = prng(seed);
  const v = new Array<number>(dim);
  for (let i = 0; i < dim; i++) v[i] = rng() * 2 - 1;
  return v;
}

function recallAtK(approx: string[], truth: string[]): number {
  if (truth.length === 0) return 1;
  const t = new Set(truth);
  let hit = 0;
  for (const id of approx) if (t.has(id)) hit++;
  return hit / truth.length;
}

/* -------------------------------------------------------------------------- */

describe('buildLshIndex', () => {
  it('is deterministic: same rows+seed → identical tables/planes/buckets', () => {
    const rows = makeCorpus(120, 24, 3);
    const a = buildLshIndex(rows, { numPlanes: 12, numTables: 4, seed: 42 });
    const b = buildLshIndex(rows, { numPlanes: 12, numTables: 4, seed: 42 });
    assert.equal(a.tables.length, 4);
    assert.deepEqual(
      a.tables.map((t) => t.planes),
      b.tables.map((t) => t.planes),
    );
    for (let t = 0; t < a.tables.length; t++) {
      assert.deepEqual(
        Array.from(a.tables[t].buckets.entries()).sort(),
        Array.from(b.tables[t].buckets.entries()).sort(),
      );
    }
  });

  it('independent tables have distinct planes (amplification, not copies)', () => {
    const rows = makeCorpus(40, 16, 3);
    const idx = buildLshIndex(rows, { numPlanes: 12, numTables: 3, seed: 1 });
    assert.notDeepEqual(idx.tables[0].planes, idx.tables[1].planes);
    assert.notDeepEqual(idx.tables[1].planes, idx.tables[2].planes);
  });

  it('different base seeds produce different planes', () => {
    const rows = makeCorpus(40, 16, 3);
    const a = buildLshIndex(rows, { numPlanes: 12, numTables: 2, seed: 1 });
    const b = buildLshIndex(rows, { numPlanes: 12, numTables: 2, seed: 2 });
    assert.notDeepEqual(a.tables[0].planes, b.tables[0].planes);
  });

  it('skips wrong-dim and empty rows entirely (shared across tables)', () => {
    const rows: LshRow[] = [
      { recordId: 'ok1', object: 'people', vector: [1, 0, 0, 0], dim: 4 },
      { recordId: 'ok2', object: 'people', vector: [0, 1, 0, 0], dim: 4 },
      { recordId: 'baddim', object: 'people', vector: [1, 0], dim: 2 }, // wrong dim
      { recordId: 'mismatch', object: 'people', vector: [1, 0, 0], dim: 4 }, // len≠dim
      { recordId: 'empty', object: 'people', vector: [], dim: 0 },
    ];
    const idx = buildLshIndex(rows, { numPlanes: 8, numTables: 3, seed: 1 });
    assert.equal(idx.dim, 4);
    assert.deepEqual(idx.rows.map((r) => r.recordId).sort(), ['ok1', 'ok2']);
    // Every table indexes the same kept rows.
    for (const table of idx.tables) {
      const indexed = new Set<number>();
      for (const list of table.buckets.values()) for (const i of list) indexed.add(i);
      assert.equal(indexed.size, 2);
    }
  });
});

describe('queryLsh recall vs brute-force', () => {
  it('recall@10 is high on a clustered synthetic corpus', () => {
    const dim = 32;
    const rows = makeCorpus(500, dim, 11);
    const idx = buildLshIndex(rows, { numPlanes: 12, numTables: 6, seed: 5 });

    let total = 0;
    let queries = 0;
    for (let q = 0; q < 20; q++) {
      const query = makeQuery(dim, 100 + q);
      const truth = topKByCosine(query, rows, 10, dim).map((r) => r.recordId);
      const approx = queryLsh(idx, query, 10, { maxHamming: 6, minCandidates: 120 }).map(
        (r) => r.recordId,
      );
      total += recallAtK(approx, truth);
      queries++;
    }
    const meanRecall = total / queries;
    assert.ok(
      meanRecall >= 0.85,
      `mean recall@10 ${meanRecall.toFixed(3)} should be >= 0.85`,
    );
  });

  it('multi-table beats single-table recall (amplification is real)', () => {
    const dim = 32;
    const rows = makeCorpus(500, dim, 11);
    const single = buildLshIndex(rows, { numPlanes: 12, numTables: 1, seed: 5 });
    const multi = buildLshIndex(rows, { numPlanes: 12, numTables: 8, seed: 5 });
    const score = (idx: typeof single) => {
      let total = 0;
      for (let q = 0; q < 15; q++) {
        const query = makeQuery(dim, 200 + q);
        const truth = topKByCosine(query, rows, 10, dim).map((r) => r.recordId);
        const approx = queryLsh(idx, query, 10, {
          maxHamming: 4,
          minCandidates: 100,
        }).map((r) => r.recordId);
        total += recallAtK(approx, truth);
      }
      return total / 15;
    };
    assert.ok(
      score(multi) > score(single),
      'L=8 tables must out-recall L=1 at the same candidate budget',
    );
  });

  it('top-1 matches brute-force exactly when probe covers the best row', () => {
    const dim = 16;
    const rows = makeCorpus(200, dim, 21);
    const idx = buildLshIndex(rows, { numPlanes: 12, numTables: 6, seed: 9 });
    const query = makeQuery(dim, 555);
    const truthTop = topKByCosine(query, rows, 1, dim)[0];
    // Wide probe so the exact best is in-candidates → identical top result.
    const approx = queryLsh(idx, query, 1, { maxHamming: 8, minCandidates: 150 });
    assert.equal(approx[0].recordId, truthTop.recordId);
  });

  it('scores are sorted descending and positive-only, capped at topK', () => {
    const dim = 16;
    const rows = makeCorpus(80, dim, 2);
    const idx = buildLshIndex(rows, { numPlanes: 10, numTables: 4, seed: 3 });
    const query = makeQuery(dim, 7);
    const out = queryLsh(idx, query, 5);
    assert.ok(out.length <= 5);
    for (let i = 1; i < out.length; i++) assert.ok(out[i - 1].score >= out[i].score);
    for (const r of out) assert.ok(r.score > 0);
  });
});

describe('graceful full-scan fallback', () => {
  it('tiny corpus (fewer rows than minCandidates) still returns brute-force top-K', () => {
    const dim = 8;
    const rows = makeCorpus(6, dim, 4); // far below default minCandidates
    const idx = buildLshIndex(rows, { numPlanes: 12, numTables: 4, seed: 1 });
    const query = makeQuery(dim, 33);
    const truth = topKByCosine(query, rows, 3, dim).map((r) => r.recordId);
    const approx = queryLsh(idx, query, 3).map((r) => r.recordId); // defaults → falls back
    // With a full-scan fallback the approximate result equals brute-force.
    assert.deepEqual(approx, truth);
  });
});

describe('edges & safety', () => {
  it('empty index → empty result', () => {
    const idx = buildLshIndex([], { numPlanes: 8, numTables: 4, seed: 1 });
    assert.equal(idx.dim, 0);
    assert.equal(idx.tables.length, 0);
    assert.deepEqual(queryLsh(idx, [1, 2, 3], 5), []);
  });

  it('dim-mismatch query → empty result (never throws / NaN)', () => {
    const rows = makeCorpus(50, 12, 1);
    const idx = buildLshIndex(rows, { numPlanes: 8, numTables: 4, seed: 1 });
    assert.deepEqual(queryLsh(idx, [1, 0], 5), []); // query dim 2 ≠ index dim 12
  });

  it('last row is reachable (no off-by-one in bucketing)', () => {
    const dim = 10;
    const rows = makeCorpus(60, dim, 6);
    const last = rows[rows.length - 1];
    const idx = buildLshIndex(rows, { numPlanes: 12, numTables: 6, seed: 8 });
    // Query with the last row's own vector → it must rank #1 (cosine 1.0).
    const out = queryLsh(idx, last.vector, 5, { maxHamming: 6, minCandidates: 60 });
    assert.equal(out[0].recordId, last.recordId);
    assert.ok(Math.abs(out[0].score - 1) < 1e-9);
  });

  it('topK <= 0 is coerced to at least 1', () => {
    const rows = makeCorpus(40, 8, 1);
    const idx = buildLshIndex(rows, { numPlanes: 8, numTables: 4, seed: 1 });
    const out = queryLsh(idx, makeQuery(8, 2), 0);
    assert.ok(out.length >= 1);
  });
});
