/**
 * SabFlow — CRDT convergence fuzz tests.
 *
 * Phase C.8 · sub-task #8.
 *
 * Spins up N (=4) in-memory replicas of the SabFlow Yjs doc shape
 * (`Y.Array('nodes')`, `Y.Array('edges')`, `Y.Map('viewport')` — see
 * `src/lib/sabflow/client/undo-redo.ts` for the canonical layout),
 * generates K (=1000) random graph operations per replica, exchanges
 * updates between replicas in a random interleaving, and verifies that
 * every replica converges to the **same** final state.
 *
 * Operations covered (mirrors the editor's public mutation set):
 *   - insertNode        (add a node with random params)
 *   - deleteNode        (remove a random existing node)
 *   - moveNode          (update a node's `position.{x,y}`)
 *   - updateNodeParams  (overwrite a node's `params` map entries)
 *   - addEdge           (connect two random nodes)
 *   - removeEdge        (remove a random existing edge)
 *
 * Run with Node's built-in `node:test` + `tsx` (same as every other
 * test in this repo — see `src/lib/__tests__/rbac.test.ts`):
 *
 *   npx tsx --test src/lib/sabflow/__tests__/crdt-fuzz.test.ts
 *
 * Reproduce a failure by re-running with the printed seed:
 *
 *   SABFLOW_CRDT_FUZZ_SEED=0xdeadbeef \
 *     npx tsx --test src/lib/sabflow/__tests__/crdt-fuzz.test.ts
 *
 * Crank the iteration counts for a soak run:
 *
 *   SABFLOW_CRDT_FUZZ_OPS=10000 SABFLOW_CRDT_FUZZ_REPLICAS=8 \
 *     npx tsx --test src/lib/sabflow/__tests__/crdt-fuzz.test.ts
 *
 * Dependencies — zero new deps. We use a hand-rolled xorshift32 PRNG
 * seeded from `SABFLOW_CRDT_FUZZ_SEED` (or `Date.now()` if unset), and
 * a dynamic `import('yjs')` that gracefully falls back to an in-file
 * deterministic CRDT stub if `yjs` is not installed in the workspace
 * (the existing `services/sabflow-ws/test/fuzz/protocol.fuzz.test.ts`
 * uses the same pattern). The stub is a faithful model of the
 * SabFlow doc's convergence semantics — LWW on map fields keyed by
 * (lamportClock, replicaId), set-union for inserts, tombstone-on-delete
 * — so the fuzz harness still exercises real convergence properties
 * even on a workspace without yjs installed.
 */

import { strict as assert } from 'node:assert';
import { describe, it, before } from 'node:test';

// ---------------------------------------------------------------------------
// CRDT replica contract — what the fuzzer needs from a doc, expressed as a
// small structural interface so we can swap between real yjs and our stub.
// ---------------------------------------------------------------------------

/** A node in the SabFlow graph as the fuzzer sees it. */
interface FuzzNode {
  id: string;
  position: { x: number; y: number };
  params: Record<string, number | string>;
}

/** An edge in the SabFlow graph as the fuzzer sees it. */
interface FuzzEdge {
  id: string;
  source: string;
  target: string;
}

/**
 * Canonical, replica-independent view of a doc — what we compare across
 * replicas to assert convergence. Sorted by id so map insertion order
 * differences don't masquerade as divergence.
 */
interface CanonicalState {
  nodes: FuzzNode[];
  edges: FuzzEdge[];
}

/**
 * One replica. The fuzzer treats this opaquely except for `apply`,
 * `encodeStateAsUpdate`, `encodeStateVector`, `applyUpdate`, and `read`.
 *
 * For a real yjs-backed replica:
 *   - `apply` runs a mutation inside a `Y.transact`
 *   - `encodeStateAsUpdate` / `encodeStateVector` call into yjs
 *   - `applyUpdate` calls `Y.applyUpdate`
 *
 * For the stub replica these map onto the deterministic in-memory CRDT
 * defined further down.
 */
interface FuzzReplica {
  readonly id: string;
  insertNode(node: FuzzNode): void;
  deleteNode(id: string): void;
  moveNode(id: string, x: number, y: number): void;
  updateNodeParams(id: string, params: Record<string, number | string>): void;
  addEdge(edge: FuzzEdge): void;
  removeEdge(id: string): void;
  /**
   * Snapshot of all updates emitted since the start of the run. The
   * fuzzer exchanges these between replicas in a random order. The
   * specific encoding doesn't matter — the only contract is that
   * `applyUpdate` round-trips an `encodeStateAsUpdate` produced by
   * any other replica.
   */
  encodeStateAsUpdate(stateVector?: Uint8Array): Uint8Array;
  encodeStateVector(): Uint8Array;
  applyUpdate(update: Uint8Array): void;
  /** Replica-independent, sorted view used for convergence assertions. */
  read(): CanonicalState;
}

interface ReplicaFactory {
  create(id: string): FuzzReplica;
  /** Human-readable name, surfaced in stderr so we know which backend ran. */
  readonly backend: 'yjs' | 'stub';
}

// ---------------------------------------------------------------------------
// Stub CRDT — a faithful-enough model of yjs convergence for the SabFlow
// doc shape. Used when the workspace does not have `yjs` installed.
// ---------------------------------------------------------------------------
//
// Semantics:
//   - Each replica owns a Lamport-style monotonic counter.
//   - Every field write produces an op tagged
//     (lamport, replicaId, fieldPath, value).
//   - Conflict resolution: highest (lamport, replicaId) wins ("LWW" — for
//     nodes/edges this matches yjs's `Y.Map.set` semantics).
//   - Deletes produce a tombstone op tagged (lamport, replicaId, tombstoneOf).
//     A node is "alive" iff it has been inserted **and** the highest
//     (lamport, replicaId) op against it is not a tombstone — matching yjs's
//     "removed entries stay removed" behaviour for Y.Array of Y.Map.
//   - Updates are append-only sets of ops. `applyUpdate` is a set-union of
//     ops; the resolver is purely a function of the resulting set, so it is
//     trivially commutative, associative, and idempotent ⇒ strong eventual
//     consistency.
//
// This stub is intentionally smaller than yjs (no rich text, no awareness,
// no compaction) but it covers exactly the convergence properties the fuzz
// test cares about for nodes + edges + their scalar fields. A green run
// against the stub proves the fuzz harness itself is correct; a green run
// against real yjs proves yjs converges under the same workload.

interface StubOp {
  /** Lamport timestamp. */
  l: number;
  /** Replica id, used as a tie-breaker. */
  r: string;
  /**
   * Path key. Either `node:<id>`, `node:<id>:position`,
   * `node:<id>:params:<k>`, or `edge:<id>`. Tombstones use the bare
   * `node:<id>` / `edge:<id>` path with `t: true`.
   */
  p: string;
  /** Tombstone flag — true means "this op removes the entity". */
  t?: true;
  /**
   * Insert flag — true on the first insertNode/addEdge op for a given id.
   * The resolver only treats an entity as "ever existed" if there is at
   * least one insert op for it, which prevents updateNodeParams on a
   * stranger-replica from spawning a phantom node.
   */
  i?: true;
  /** Opaque value payload (position, params entry, edge endpoints). */
  v?: unknown;
}

function opCmp(a: StubOp, b: StubOp): number {
  // Higher lamport wins. Same lamport: lexicographic replica id wins.
  if (a.l !== b.l) return a.l - b.l;
  if (a.r === b.r) return 0;
  return a.r < b.r ? -1 : 1;
}

/**
 * Stable JSON: keys in lexicographic order, no surprises across replicas.
 * Used so updates can be `Uint8Array`-encoded deterministically.
 */
function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map(stableStringify).join(',') + ']';
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  return (
    '{' +
    keys
      .map(
        (k) =>
          JSON.stringify(k) +
          ':' +
          stableStringify((value as Record<string, unknown>)[k]),
      )
      .join(',') +
    '}'
  );
}

class StubReplica implements FuzzReplica {
  readonly id: string;
  /** Append-only op log. Convergence is `read()` over this set. */
  private readonly ops: StubOp[] = [];
  /** Dedup index — `${l}:${r}:${p}:${t?1:0}:${i?1:0}` → true. */
  private readonly seen = new Set<string>();
  private lamport = 0;

  constructor(id: string) {
    this.id = id;
  }

  private nextLamport(): number {
    this.lamport += 1;
    return this.lamport;
  }

  private pushOp(op: StubOp): void {
    const key = `${op.l}:${op.r}:${op.p}:${op.t ? 1 : 0}:${op.i ? 1 : 0}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.ops.push(op);
  }

  // ── Mutation API ────────────────────────────────────────────────────

  insertNode(node: FuzzNode): void {
    const l = this.nextLamport();
    // Insert marker.
    this.pushOp({ l, r: this.id, p: `node:${node.id}`, i: true, v: null });
    // Position write.
    this.pushOp({
      l,
      r: this.id,
      p: `node:${node.id}:position`,
      v: { x: node.position.x, y: node.position.y },
    });
    // Each param key as its own LWW cell, matching yjs Y.Map field semantics.
    for (const [k, val] of Object.entries(node.params)) {
      this.pushOp({
        l,
        r: this.id,
        p: `node:${node.id}:params:${k}`,
        v: val,
      });
    }
  }

  deleteNode(id: string): void {
    this.pushOp({
      l: this.nextLamport(),
      r: this.id,
      p: `node:${id}`,
      t: true,
    });
  }

  moveNode(id: string, x: number, y: number): void {
    this.pushOp({
      l: this.nextLamport(),
      r: this.id,
      p: `node:${id}:position`,
      v: { x, y },
    });
  }

  updateNodeParams(id: string, params: Record<string, number | string>): void {
    const l = this.nextLamport();
    for (const [k, val] of Object.entries(params)) {
      this.pushOp({
        l,
        r: this.id,
        p: `node:${id}:params:${k}`,
        v: val,
      });
    }
  }

  addEdge(edge: FuzzEdge): void {
    const l = this.nextLamport();
    this.pushOp({
      l,
      r: this.id,
      p: `edge:${edge.id}`,
      i: true,
      v: { source: edge.source, target: edge.target },
    });
  }

  removeEdge(id: string): void {
    this.pushOp({
      l: this.nextLamport(),
      r: this.id,
      p: `edge:${id}`,
      t: true,
    });
  }

  // ── Sync API ────────────────────────────────────────────────────────

  encodeStateVector(): Uint8Array {
    // The stub's state vector is { replicaId → highestLamportSeen }.
    const sv: Record<string, number> = {};
    for (const op of this.ops) {
      const cur = sv[op.r] ?? 0;
      if (op.l > cur) sv[op.r] = op.l;
    }
    return new TextEncoder().encode(stableStringify(sv));
  }

  encodeStateAsUpdate(stateVector?: Uint8Array): Uint8Array {
    let sv: Record<string, number> = {};
    if (stateVector && stateVector.length > 0) {
      try {
        sv = JSON.parse(new TextDecoder().decode(stateVector));
      } catch {
        sv = {};
      }
    }
    const out: StubOp[] = [];
    for (const op of this.ops) {
      if ((sv[op.r] ?? 0) < op.l) out.push(op);
    }
    return new TextEncoder().encode(stableStringify(out));
  }

  applyUpdate(update: Uint8Array): void {
    if (update.length === 0) return;
    let ops: StubOp[];
    try {
      ops = JSON.parse(new TextDecoder().decode(update));
    } catch {
      return;
    }
    for (const op of ops) {
      this.pushOp(op);
      if (op.l > this.lamport) this.lamport = op.l;
    }
  }

  // ── Read view — sorted, replica-independent ─────────────────────────

  read(): CanonicalState {
    // Group ops by entity path prefix.
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    for (const op of this.ops) {
      if (op.p.startsWith('node:')) {
        const id = op.p.slice('node:'.length).split(':', 1)[0]!;
        nodeIds.add(id);
      } else if (op.p.startsWith('edge:')) {
        const id = op.p.slice('edge:'.length);
        edgeIds.add(id);
      }
    }

    const nodes: FuzzNode[] = [];
    for (const id of [...nodeIds].sort()) {
      // Liveness: must have at least one insert op AND the latest op on the
      // bare `node:<id>` path must not be a tombstone.
      const bare = this.ops
        .filter((o) => o.p === `node:${id}`)
        .sort(opCmp);
      if (bare.length === 0) continue;
      const newest = bare[bare.length - 1]!;
      const hasInsert = bare.some((o) => o.i === true);
      if (!hasInsert) continue;
      if (newest.t === true) continue;

      // Position: highest-LWW op on `node:<id>:position`.
      const posOps = this.ops
        .filter((o) => o.p === `node:${id}:position`)
        .sort(opCmp);
      const pos = posOps.length
        ? (posOps[posOps.length - 1]!.v as { x: number; y: number })
        : { x: 0, y: 0 };

      // Params: per-key LWW.
      const paramPrefix = `node:${id}:params:`;
      const params: Record<string, number | string> = {};
      const paramKeys = new Set<string>();
      for (const op of this.ops) {
        if (op.p.startsWith(paramPrefix)) {
          paramKeys.add(op.p.slice(paramPrefix.length));
        }
      }
      for (const k of [...paramKeys].sort()) {
        const opsForKey = this.ops
          .filter((o) => o.p === `${paramPrefix}${k}`)
          .sort(opCmp);
        if (opsForKey.length === 0) continue;
        const w = opsForKey[opsForKey.length - 1]!;
        if (w.v !== undefined) params[k] = w.v as number | string;
      }

      nodes.push({ id, position: { x: pos.x, y: pos.y }, params });
    }

    const edges: FuzzEdge[] = [];
    for (const id of [...edgeIds].sort()) {
      const opsForId = this.ops
        .filter((o) => o.p === `edge:${id}`)
        .sort(opCmp);
      if (opsForId.length === 0) continue;
      const hasInsert = opsForId.some((o) => o.i === true);
      const newest = opsForId[opsForId.length - 1]!;
      if (!hasInsert) continue;
      if (newest.t === true) continue;
      // Pick the latest non-tombstone op that carries endpoint payload.
      const live = opsForId
        .filter((o) => o.t !== true && o.v !== undefined)
        .sort(opCmp);
      if (live.length === 0) continue;
      const v = live[live.length - 1]!.v as {
        source: string;
        target: string;
      };
      edges.push({ id, source: v.source, target: v.target });
    }

    return { nodes, edges };
  }
}

const stubFactory: ReplicaFactory = {
  backend: 'stub',
  create(id: string): FuzzReplica {
    return new StubReplica(id);
  },
};

// ---------------------------------------------------------------------------
// Real-yjs adapter — only wired up if dynamic import('yjs') succeeds.
// ---------------------------------------------------------------------------

/* eslint-disable @typescript-eslint/no-explicit-any */
type YModule = any;
/* eslint-enable @typescript-eslint/no-explicit-any */

function buildYjsFactory(Y: YModule): ReplicaFactory {
  return {
    backend: 'yjs',
    create(id: string): FuzzReplica {
      const doc = new Y.Doc({ guid: id });
      const nodes = doc.getArray('nodes');
      const edges = doc.getArray('edges');

      // Helpers — these mirror what `src/lib/sabflow/client/undo-redo.ts`
      // documents as the editor's mutation surface.
      function findNodeIndex(nodeId: string): number {
        for (let i = 0; i < nodes.length; i++) {
          const m = nodes.get(i);
          if (m && typeof m.get === 'function' && m.get('id') === nodeId) {
            return i;
          }
        }
        return -1;
      }
      function findEdgeIndex(edgeId: string): number {
        for (let i = 0; i < edges.length; i++) {
          const m = edges.get(i);
          if (m && typeof m.get === 'function' && m.get('id') === edgeId) {
            return i;
          }
        }
        return -1;
      }

      const replica: FuzzReplica = {
        id,
        insertNode(node) {
          doc.transact(() => {
            // Skip if already present (insertNode is idempotent in the
            // editor — re-inserts get coalesced into an update).
            if (findNodeIndex(node.id) !== -1) return;
            const m = new Y.Map();
            m.set('id', node.id);
            const pos = new Y.Map();
            pos.set('x', node.position.x);
            pos.set('y', node.position.y);
            m.set('position', pos);
            const params = new Y.Map();
            for (const [k, v] of Object.entries(node.params)) params.set(k, v);
            m.set('params', params);
            nodes.push([m]);
          });
        },
        deleteNode(nodeId) {
          doc.transact(() => {
            const i = findNodeIndex(nodeId);
            if (i !== -1) nodes.delete(i, 1);
          });
        },
        moveNode(nodeId, x, y) {
          doc.transact(() => {
            const i = findNodeIndex(nodeId);
            if (i === -1) return;
            const m = nodes.get(i);
            const pos = m.get('position') ?? new Y.Map();
            pos.set('x', x);
            pos.set('y', y);
            if (!m.get('position')) m.set('position', pos);
          });
        },
        updateNodeParams(nodeId, params) {
          doc.transact(() => {
            const i = findNodeIndex(nodeId);
            if (i === -1) return;
            const m = nodes.get(i);
            const p = m.get('params') ?? new Y.Map();
            for (const [k, v] of Object.entries(params)) p.set(k, v);
            if (!m.get('params')) m.set('params', p);
          });
        },
        addEdge(edge) {
          doc.transact(() => {
            if (findEdgeIndex(edge.id) !== -1) return;
            const m = new Y.Map();
            m.set('id', edge.id);
            m.set('source', edge.source);
            m.set('target', edge.target);
            edges.push([m]);
          });
        },
        removeEdge(edgeId) {
          doc.transact(() => {
            const i = findEdgeIndex(edgeId);
            if (i !== -1) edges.delete(i, 1);
          });
        },
        encodeStateAsUpdate(sv) {
          return Y.encodeStateAsUpdate(doc, sv);
        },
        encodeStateVector() {
          return Y.encodeStateVector(doc);
        },
        applyUpdate(update) {
          Y.applyUpdate(doc, update);
        },
        read() {
          const outNodes: FuzzNode[] = [];
          for (let i = 0; i < nodes.length; i++) {
            const m = nodes.get(i);
            if (!m || typeof m.get !== 'function') continue;
            const nid = String(m.get('id') ?? '');
            const pos = m.get('position');
            const px = pos && typeof pos.get === 'function' ? Number(pos.get('x') ?? 0) : 0;
            const py = pos && typeof pos.get === 'function' ? Number(pos.get('y') ?? 0) : 0;
            const pm = m.get('params');
            const params: Record<string, number | string> = {};
            if (pm && typeof pm.entries === 'function') {
              for (const [k, v] of pm.entries() as IterableIterator<
                [string, number | string]
              >) {
                params[k] = v;
              }
            }
            outNodes.push({ id: nid, position: { x: px, y: py }, params });
          }
          outNodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

          const outEdges: FuzzEdge[] = [];
          for (let i = 0; i < edges.length; i++) {
            const m = edges.get(i);
            if (!m || typeof m.get !== 'function') continue;
            outEdges.push({
              id: String(m.get('id') ?? ''),
              source: String(m.get('source') ?? ''),
              target: String(m.get('target') ?? ''),
            });
          }
          outEdges.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

          return { nodes: outNodes, edges: outEdges };
        },
      };
      return replica;
    },
  };
}

// ---------------------------------------------------------------------------
// PRNG — xorshift32, deterministic given a seed.
// ---------------------------------------------------------------------------

function parseSeed(): number {
  const raw = process.env.SABFLOW_CRDT_FUZZ_SEED;
  if (raw && raw.length > 0) {
    const n =
      raw.startsWith('0x') || raw.startsWith('0X')
        ? Number.parseInt(raw.slice(2), 16)
        : Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n !== 0) return n >>> 0;
  }
  // xorshift32(0) is a fixed point at 0 — force non-zero.
  return ((Date.now() & 0xffffffff) | 1) >>> 0;
}

function parsePosInt(envKey: string, fallback: number): number {
  const raw = process.env[envKey];
  if (raw && raw.length > 0) {
    const n = Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return fallback;
}

const SEED = parseSeed();
const NUM_REPLICAS = parsePosInt('SABFLOW_CRDT_FUZZ_REPLICAS', 4);
const NUM_OPS = parsePosInt('SABFLOW_CRDT_FUZZ_OPS', 1000);

class Xorshift32 {
  private state: number;
  constructor(seed: number) {
    this.state = (seed | 1) >>> 0;
  }
  next(): number {
    let x = this.state;
    x ^= x << 13;
    x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5;
    x >>>= 0;
    this.state = x;
    return x;
  }
  /** Uniform integer in `[0, max)`. `max` must be >= 1. */
  nextInt(max: number): number {
    if (max <= 1) return 0;
    return this.next() % max;
  }
  pick<T>(arr: readonly T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[this.nextInt(arr.length)];
  }
}

function spawn(label: string): Xorshift32 {
  // Mix the run-level seed with a label-derived hash so independent test
  // bodies don't share a stream — same trick as the sabflow-ws fuzzer.
  let h = SEED >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = (h ^ label.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0; // FNV-1a prime
  }
  if (h === 0) h = 1;
  return new Xorshift32(h);
}

// ---------------------------------------------------------------------------
// Backend resolution — try yjs, fall back to stub.
// ---------------------------------------------------------------------------

let factory: ReplicaFactory = stubFactory;
let usingStub = true;

before(async () => {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const Y = (await import('yjs')) as any;
    if (
      Y &&
      typeof Y.Doc === 'function' &&
      typeof Y.Map === 'function' &&
      typeof Y.encodeStateAsUpdate === 'function' &&
      typeof Y.applyUpdate === 'function'
    ) {
      factory = buildYjsFactory(Y);
      usingStub = false;
    } else {
      throw new Error('yjs module missing required exports');
    }
  } catch (err) {
    factory = stubFactory;
    usingStub = true;
    process.stderr.write(
      `[sabflow crdt-fuzz] yjs not available — using in-file stub CRDT (${
        err instanceof Error ? err.message : String(err)
      })\n`,
    );
  }
  process.stderr.write(
    `[sabflow crdt-fuzz] seed=0x${SEED.toString(16).padStart(
      8,
      '0',
    )} replicas=${NUM_REPLICAS} ops=${NUM_OPS} backend=${
      usingStub ? 'stub' : 'yjs'
    }\n`,
  );
});

// ---------------------------------------------------------------------------
// Random op generation
// ---------------------------------------------------------------------------

type OpKind =
  | 'insertNode'
  | 'deleteNode'
  | 'moveNode'
  | 'updateNodeParams'
  | 'addEdge'
  | 'removeEdge';

interface GenOp {
  kind: OpKind;
  /** Replica that will apply this op locally. */
  replica: number;
  /** Stable id for the entity (node or edge) the op touches. */
  entityId: string;
  /** Auxiliary payload — interpreted per-kind. */
  payload: Record<string, unknown>;
}

/**
 * Local view per replica — what we believe is "alive" *from this replica's
 * perspective* at op-generation time. Used so we don't synthesise `moveNode`
 * ops against a node the replica has never seen (which would be a no-op in
 * yjs and a no-op in the stub, but it makes the generated workload boring).
 *
 * Note: this is the replica's LOCAL view at gen time, which is an under-
 * estimate of the converged view. That's fine — operating on nodes the
 * replica hasn't seen yet IS a real-world pattern (clients move stale
 * cursors all the time) and the convergence test passes either way.
 */
interface LocalView {
  nodes: Map<string, FuzzNode>;
  edges: Map<string, FuzzEdge>;
}

function randomParams(rng: Xorshift32): Record<string, number | string> {
  const n = 1 + rng.nextInt(3);
  const out: Record<string, number | string> = {};
  for (let i = 0; i < n; i++) {
    const k = `k${rng.nextInt(8)}`;
    out[k] = rng.nextInt(2) === 0 ? rng.nextInt(1000) : `v${rng.nextInt(1000)}`;
  }
  return out;
}

function generateOps(rng: Xorshift32, numReplicas: number, count: number): GenOp[] {
  const ops: GenOp[] = [];
  const local: LocalView[] = Array.from({ length: numReplicas }, () => ({
    nodes: new Map(),
    edges: new Map(),
  }));
  let nodeCounter = 0;
  let edgeCounter = 0;

  // The op-kind weights bias toward inserts early so the graph fills out
  // before deletes/moves dominate.
  function pickKind(replica: number, opIndex: number): OpKind {
    const view = local[replica]!;
    const haveNodes = view.nodes.size > 0;
    const haveEdgeCandidates = view.nodes.size >= 2;
    const haveEdges = view.edges.size > 0;
    const earlyBias = opIndex < count / 4;

    // Build a weighted bag.
    const bag: OpKind[] = ['insertNode', 'insertNode'];
    if (earlyBias) bag.push('insertNode');
    if (haveNodes) {
      bag.push('moveNode', 'updateNodeParams');
      if (!earlyBias) bag.push('deleteNode');
    }
    if (haveEdgeCandidates) bag.push('addEdge', 'addEdge');
    if (haveEdges && !earlyBias) bag.push('removeEdge');
    return bag[rng.nextInt(bag.length)]!;
  }

  for (let i = 0; i < count; i++) {
    const replica = rng.nextInt(numReplicas);
    const view = local[replica]!;
    const kind = pickKind(replica, i);

    if (kind === 'insertNode') {
      const id = `n${nodeCounter++}`;
      const node: FuzzNode = {
        id,
        position: { x: rng.nextInt(1000), y: rng.nextInt(1000) },
        params: randomParams(rng),
      };
      view.nodes.set(id, node);
      ops.push({ kind, replica, entityId: id, payload: { node } });
      continue;
    }

    if (kind === 'deleteNode') {
      const id = rng.pick([...view.nodes.keys()])!;
      view.nodes.delete(id);
      // Also drop any edges that this replica believes are attached to it,
      // so we don't generate a `removeEdge` for an edge whose endpoints
      // have already been deleted locally (real editors do the same in a
      // single transaction; we just split the ops for fuzz purposes).
      for (const [eid, e] of view.edges) {
        if (e.source === id || e.target === id) view.edges.delete(eid);
      }
      ops.push({ kind, replica, entityId: id, payload: {} });
      continue;
    }

    if (kind === 'moveNode') {
      const id = rng.pick([...view.nodes.keys()])!;
      const x = rng.nextInt(1000);
      const y = rng.nextInt(1000);
      const n = view.nodes.get(id)!;
      n.position = { x, y };
      ops.push({ kind, replica, entityId: id, payload: { x, y } });
      continue;
    }

    if (kind === 'updateNodeParams') {
      const id = rng.pick([...view.nodes.keys()])!;
      const params = randomParams(rng);
      const n = view.nodes.get(id)!;
      n.params = { ...n.params, ...params };
      ops.push({ kind, replica, entityId: id, payload: { params } });
      continue;
    }

    if (kind === 'addEdge') {
      const ids = [...view.nodes.keys()];
      const source = ids[rng.nextInt(ids.length)]!;
      let target = ids[rng.nextInt(ids.length)]!;
      // Prefer distinct endpoints when possible.
      if (target === source && ids.length > 1) {
        target = ids[(ids.indexOf(source) + 1) % ids.length]!;
      }
      const id = `e${edgeCounter++}`;
      const edge: FuzzEdge = { id, source, target };
      view.edges.set(id, edge);
      ops.push({ kind, replica, entityId: id, payload: { edge } });
      continue;
    }

    if (kind === 'removeEdge') {
      const id = rng.pick([...view.edges.keys()])!;
      view.edges.delete(id);
      ops.push({ kind, replica, entityId: id, payload: {} });
      continue;
    }
  }

  return ops;
}

function applyOp(rep: FuzzReplica, op: GenOp): void {
  switch (op.kind) {
    case 'insertNode':
      rep.insertNode(op.payload.node as FuzzNode);
      return;
    case 'deleteNode':
      rep.deleteNode(op.entityId);
      return;
    case 'moveNode':
      rep.moveNode(
        op.entityId,
        op.payload.x as number,
        op.payload.y as number,
      );
      return;
    case 'updateNodeParams':
      rep.updateNodeParams(
        op.entityId,
        op.payload.params as Record<string, number | string>,
      );
      return;
    case 'addEdge':
      rep.addEdge(op.payload.edge as FuzzEdge);
      return;
    case 'removeEdge':
      rep.removeEdge(op.entityId);
      return;
  }
}

// ---------------------------------------------------------------------------
// Convergence assertions
// ---------------------------------------------------------------------------

function canonicalize(s: CanonicalState): string {
  // Sort entries deterministically and stringify.
  const norm = {
    nodes: s.nodes.map((n) => ({
      id: n.id,
      position: { x: n.position.x, y: n.position.y },
      params: Object.fromEntries(
        Object.entries(n.params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    })),
    edges: s.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  };
  return stableStringify(norm);
}

function assertConverged(replicas: FuzzReplica[], ctx: string): void {
  if (replicas.length === 0) return;
  const baseline = canonicalize(replicas[0]!.read());
  for (let i = 1; i < replicas.length; i++) {
    const other = canonicalize(replicas[i]!.read());
    if (other !== baseline) {
      // Give a useful diff hint: first 200 bytes of each.
      const head = (s: string) => (s.length > 200 ? s.slice(0, 200) + '…' : s);
      assert.fail(
        `replicas diverged (${ctx})\n` +
          `  replica[0] = ${head(baseline)}\n` +
          `  replica[${i}] = ${head(other)}\n` +
          `  REPRO: SABFLOW_CRDT_FUZZ_SEED=0x${SEED.toString(16).padStart(
            8,
            '0',
          )} SABFLOW_CRDT_FUZZ_REPLICAS=${NUM_REPLICAS} SABFLOW_CRDT_FUZZ_OPS=${NUM_OPS}`,
      );
    }
  }
}

/**
 * Full pairwise gossip: have each replica share its updates with every
 * other replica, then have every replica re-emit its (now-extended) state
 * so any indirectly-discovered ops also propagate. Two rounds suffice for
 * a complete graph; we run three for safety margin against any iteration
 * order pathology in the stub or yjs.
 */
function gossipAll(replicas: FuzzReplica[]): void {
  for (let round = 0; round < 3; round++) {
    for (const src of replicas) {
      const update = src.encodeStateAsUpdate();
      for (const dst of replicas) {
        if (dst === src) continue;
        dst.applyUpdate(update);
      }
    }
  }
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CRDT fuzz — eventual consistency under random interleavings', () => {
  it(`${NUM_REPLICAS} replicas × ${NUM_OPS} ops each, random order, all converge`, () => {
    const opRng = spawn('gen-ops');
    const orderRng = spawn('exchange-order');

    const replicas: FuzzReplica[] = Array.from(
      { length: NUM_REPLICAS },
      (_, i) => factory.create(`r${i}`),
    );
    const ops = generateOps(opRng, NUM_REPLICAS, NUM_OPS);

    // Apply each op LOCALLY on its origin replica, then push a snapshot of
    // that replica's outgoing update to a per-pair queue addressed to a
    // *random* other replica. The receiving replica drains the queue at a
    // random later step. This interleaves "edit on A" with "deliver A's
    // update to B" so we exercise the at-least-once, out-of-order delivery
    // contract documented in `docs/adr/sabflow-sync-ordering.md`.
    interface PendingDelivery {
      from: number;
      to: number;
      update: Uint8Array;
    }
    const pending: PendingDelivery[] = [];

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i]!;
      const rep = replicas[op.replica]!;
      applyOp(rep, op);

      // After each local mutation, schedule a delivery from this replica
      // to a random other replica. The update is computed lazily right
      // now so it captures the post-mutation state.
      if (NUM_REPLICAS > 1) {
        const update = rep.encodeStateAsUpdate();
        let to = orderRng.nextInt(NUM_REPLICAS);
        if (to === op.replica) to = (to + 1) % NUM_REPLICAS;
        pending.push({ from: op.replica, to, update });

        // With some probability, drain a random pending delivery RIGHT
        // NOW — this is what creates the interleaving: replica A might
        // see replica B's update applied before its own next local op.
        if (pending.length > 0 && orderRng.nextInt(3) === 0) {
          const idx = orderRng.nextInt(pending.length);
          const [d] = pending.splice(idx, 1);
          replicas[d!.to]!.applyUpdate(d!.update);
        }
      }
    }

    // Drain any remaining deliveries in a fully random order — the at-least-
    // once contract means a real network would have delivered each of these
    // (possibly multiple times). We apply each exactly once here; idempotence
    // is exercised by the second test below.
    while (pending.length > 0) {
      const idx = orderRng.nextInt(pending.length);
      const [d] = pending.splice(idx, 1);
      replicas[d!.to]!.applyUpdate(d!.update);
    }

    // Final gossip — guarantees every replica has seen every other replica's
    // current state. Without this, replica A might be missing a late-life
    // update from replica B that A's pending queue never received.
    gossipAll(replicas);

    assertConverged(replicas, 'random-interleaving final state');

    // Sanity: at least *some* nodes survived. If the generator deletes
    // everything we miss most of the interesting convergence work.
    const finalSize = replicas[0]!.read().nodes.length;
    assert.ok(
      finalSize >= 1 || NUM_OPS < 8,
      `expected at least one live node after ${NUM_OPS} ops, got ${finalSize}`,
    );
  });

  it('redundant deliveries are idempotent (at-least-once safe)', () => {
    const opRng = spawn('idem-ops');
    const orderRng = spawn('idem-order');

    const replicas: FuzzReplica[] = Array.from(
      { length: NUM_REPLICAS },
      (_, i) => factory.create(`i${i}`),
    );

    // Smaller workload — we're testing idempotence, not graph richness.
    const ops = generateOps(opRng, NUM_REPLICAS, Math.max(64, Math.floor(NUM_OPS / 4)));
    for (const op of ops) {
      applyOp(replicas[op.replica]!, op);
    }

    // Capture each replica's full state as an update.
    const updates = replicas.map((r) => r.encodeStateAsUpdate());

    // Deliver every update to every replica multiple times, in a random
    // order each time. Yjs (and the stub) must absorb duplicates without
    // observable effect.
    for (let pass = 0; pass < 5; pass++) {
      // Build a shuffled delivery schedule.
      const schedule: Array<{ from: number; to: number }> = [];
      for (let f = 0; f < replicas.length; f++) {
        for (let t = 0; t < replicas.length; t++) {
          if (f === t) continue;
          schedule.push({ from: f, to: t });
        }
      }
      // Fisher–Yates.
      for (let i = schedule.length - 1; i > 0; i--) {
        const j = orderRng.nextInt(i + 1);
        const tmp = schedule[i]!;
        schedule[i] = schedule[j]!;
        schedule[j] = tmp;
      }
      for (const { from, to } of schedule) {
        replicas[to]!.applyUpdate(updates[from]!);
      }
    }

    assertConverged(replicas, 'idempotent redelivery final state');
  });

  it('partition recovery — silent split, late catch-up still converges', () => {
    const rng = spawn('partition');
    const replicas: FuzzReplica[] = Array.from(
      { length: NUM_REPLICAS },
      (_, i) => factory.create(`p${i}`),
    );
    if (replicas.length < 2) {
      // Single-replica run — partition test isn't meaningful.
      return;
    }

    // Phase 1: split replicas into two groups; gossip only within each.
    const half = Math.floor(replicas.length / 2);
    const groupA = replicas.slice(0, half);
    const groupB = replicas.slice(half);

    const ops = generateOps(rng, replicas.length, Math.max(64, Math.floor(NUM_OPS / 4)));
    for (const op of ops) {
      applyOp(replicas[op.replica]!, op);
      // Gossip only within the op's own group.
      const myGroup = op.replica < half ? groupA : groupB;
      if (myGroup.length > 1) {
        const u = replicas[op.replica]!.encodeStateAsUpdate();
        for (const peer of myGroup) {
          if (peer === replicas[op.replica]) continue;
          peer.applyUpdate(u);
        }
      }
    }

    // Sanity: groups should NOT be converged with each other yet (unless
    // the random workload happened to produce identical states, which is
    // possible but unlikely — we don't assert non-convergence to avoid a
    // flake).
    // Phase 2: heal the partition with a full pairwise gossip.
    gossipAll(replicas);

    assertConverged(replicas, 'partition-heal final state');
  });
});
