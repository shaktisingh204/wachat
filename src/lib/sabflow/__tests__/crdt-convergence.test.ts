/**
 * SabFlow — CRDT convergence + fuzz property tests.
 *
 * C.8.8 — complementary to `crdt-fuzz.test.ts` (multi-replica soak).
 *
 * This file focuses on three targeted convergence properties:
 *
 *   1. **Property test** — two independent Y.Doc (or stub) replicas apply
 *      random sequences of node-add / node-move / edge-add / edge-delete ops
 *      independently, then merge via `encodeStateAsUpdate` / `applyUpdate`.
 *      After the merge both replicas must be deepEqual.
 *
 *   2. **Concurrent rename** — two clients rename the same node to different
 *      values concurrently. After merge exactly one value wins (LWW) and no
 *      crash occurs.
 *
 *   3. **Deletion-vs-edit conflict** — one client deletes a node while another
 *      edits it (moves + param update). After merge there must be no orphaned
 *      edges referencing the deleted node.
 *
 * Run:
 *   npx tsx --test src/lib/sabflow/__tests__/crdt-convergence.test.ts
 *
 * Reproduce a specific failure:
 *   SABFLOW_CONV_SEED=0x<hex> npx tsx --test ...
 *
 * Dependencies: zero new deps. Uses the same seeded xorshift32 PRNG and the
 * same stub CRDT adapter defined in this file (no yjs required; falls back
 * gracefully if yjs IS installed).
 */

import { strict as assert } from 'node:assert';
import { describe, it, before } from 'node:test';

// ---------------------------------------------------------------------------
// CRDT replica contract (same interface as crdt-fuzz.test.ts)
// ---------------------------------------------------------------------------

interface FuzzNode {
  id: string;
  label: string;
  position: { x: number; y: number };
  params: Record<string, number | string>;
}

interface FuzzEdge {
  id: string;
  source: string;
  target: string;
}

interface CanonicalState {
  nodes: FuzzNode[];
  edges: FuzzEdge[];
}

interface FuzzReplica {
  readonly id: string;
  insertNode(node: FuzzNode): void;
  deleteNode(id: string): void;
  moveNode(id: string, x: number, y: number): void;
  renameNode(id: string, label: string): void;
  updateNodeParams(id: string, params: Record<string, number | string>): void;
  addEdge(edge: FuzzEdge): void;
  removeEdge(id: string): void;
  encodeStateAsUpdate(stateVector?: Uint8Array): Uint8Array;
  encodeStateVector(): Uint8Array;
  applyUpdate(update: Uint8Array): void;
  read(): CanonicalState;
}

interface ReplicaFactory {
  create(id: string): FuzzReplica;
  readonly backend: 'yjs' | 'stub';
}

// ---------------------------------------------------------------------------
// Stub CRDT (LWW ops + tombstones — same semantics as crdt-fuzz.test.ts,
// extended with a `label` field for rename tests)
// ---------------------------------------------------------------------------

interface StubOp {
  l: number;
  r: string;
  p: string;
  t?: true;
  i?: true;
  v?: unknown;
}

function opCmp(a: StubOp, b: StubOp): number {
  if (a.l !== b.l) return a.l - b.l;
  if (a.r === b.r) return 0;
  return a.r < b.r ? -1 : 1;
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value))
    return '[' + value.map(stableStringify).join(',') + ']';
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
  private readonly ops: StubOp[] = [];
  private readonly seen = new Set<string>();
  private lamport = 0;

  constructor(id: string) {
    this.id = id;
  }

  private nextL(): number {
    return ++this.lamport;
  }

  private push(op: StubOp): void {
    const key = `${op.l}:${op.r}:${op.p}:${op.t ? 1 : 0}:${op.i ? 1 : 0}`;
    if (this.seen.has(key)) return;
    this.seen.add(key);
    this.ops.push(op);
  }

  insertNode(node: FuzzNode): void {
    const l = this.nextL();
    this.push({ l, r: this.id, p: `node:${node.id}`, i: true, v: null });
    this.push({ l, r: this.id, p: `node:${node.id}:label`, v: node.label });
    this.push({
      l,
      r: this.id,
      p: `node:${node.id}:position`,
      v: { x: node.position.x, y: node.position.y },
    });
    for (const [k, val] of Object.entries(node.params)) {
      this.push({ l, r: this.id, p: `node:${node.id}:params:${k}`, v: val });
    }
  }

  deleteNode(id: string): void {
    this.push({ l: this.nextL(), r: this.id, p: `node:${id}`, t: true });
  }

  moveNode(id: string, x: number, y: number): void {
    this.push({
      l: this.nextL(),
      r: this.id,
      p: `node:${id}:position`,
      v: { x, y },
    });
  }

  renameNode(id: string, label: string): void {
    this.push({ l: this.nextL(), r: this.id, p: `node:${id}:label`, v: label });
  }

  updateNodeParams(id: string, params: Record<string, number | string>): void {
    const l = this.nextL();
    for (const [k, val] of Object.entries(params)) {
      this.push({ l, r: this.id, p: `node:${id}:params:${k}`, v: val });
    }
  }

  addEdge(edge: FuzzEdge): void {
    const l = this.nextL();
    this.push({
      l,
      r: this.id,
      p: `edge:${edge.id}`,
      i: true,
      v: { source: edge.source, target: edge.target },
    });
  }

  removeEdge(id: string): void {
    this.push({ l: this.nextL(), r: this.id, p: `edge:${id}`, t: true });
  }

  encodeStateVector(): Uint8Array {
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
      this.push(op);
      if (op.l > this.lamport) this.lamport = op.l;
    }
  }

  read(): CanonicalState {
    const nodeIds = new Set<string>();
    const edgeIds = new Set<string>();
    for (const op of this.ops) {
      if (op.p.startsWith('node:')) {
        nodeIds.add(op.p.slice('node:'.length).split(':', 1)[0]!);
      } else if (op.p.startsWith('edge:')) {
        edgeIds.add(op.p.slice('edge:'.length));
      }
    }

    const nodes: FuzzNode[] = [];
    for (const id of [...nodeIds].sort()) {
      const bare = this.ops.filter((o) => o.p === `node:${id}`).sort(opCmp);
      if (bare.length === 0) continue;
      const newest = bare[bare.length - 1]!;
      if (!bare.some((o) => o.i === true)) continue;
      if (newest.t === true) continue;

      const posOps = this.ops
        .filter((o) => o.p === `node:${id}:position`)
        .sort(opCmp);
      const pos = posOps.length
        ? (posOps[posOps.length - 1]!.v as { x: number; y: number })
        : { x: 0, y: 0 };

      const labelOps = this.ops
        .filter((o) => o.p === `node:${id}:label`)
        .sort(opCmp);
      const label =
        labelOps.length > 0
          ? String(labelOps[labelOps.length - 1]!.v ?? '')
          : '';

      const paramPrefix = `node:${id}:params:`;
      const paramKeys = new Set<string>();
      for (const op of this.ops) {
        if (op.p.startsWith(paramPrefix)) paramKeys.add(op.p.slice(paramPrefix.length));
      }
      const params: Record<string, number | string> = {};
      for (const k of [...paramKeys].sort()) {
        const opsK = this.ops
          .filter((o) => o.p === `${paramPrefix}${k}`)
          .sort(opCmp);
        if (opsK.length === 0) continue;
        const w = opsK[opsK.length - 1]!;
        if (w.v !== undefined) params[k] = w.v as number | string;
      }

      nodes.push({ id, label, position: { x: pos.x, y: pos.y }, params });
    }

    const edges: FuzzEdge[] = [];
    for (const id of [...edgeIds].sort()) {
      const opsForId = this.ops.filter((o) => o.p === `edge:${id}`).sort(opCmp);
      if (opsForId.length === 0) continue;
      if (!opsForId.some((o) => o.i === true)) continue;
      if (opsForId[opsForId.length - 1]!.t === true) continue;
      const live = opsForId
        .filter((o) => o.t !== true && o.v !== undefined)
        .sort(opCmp);
      if (live.length === 0) continue;
      const v = live[live.length - 1]!.v as { source: string; target: string };
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
// Real-yjs adapter (wired up in `before` if yjs is installed)
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

      function findNodeIdx(nodeId: string): number {
        for (let i = 0; i < nodes.length; i++) {
          const m = nodes.get(i);
          if (m && typeof m.get === 'function' && m.get('id') === nodeId) return i;
        }
        return -1;
      }
      function findEdgeIdx(edgeId: string): number {
        for (let i = 0; i < edges.length; i++) {
          const m = edges.get(i);
          if (m && typeof m.get === 'function' && m.get('id') === edgeId) return i;
        }
        return -1;
      }

      const replica: FuzzReplica = {
        id,
        insertNode(node) {
          doc.transact(() => {
            if (findNodeIdx(node.id) !== -1) return;
            const m = new Y.Map();
            m.set('id', node.id);
            m.set('label', node.label);
            const pos = new Y.Map();
            pos.set('x', node.position.x);
            pos.set('y', node.position.y);
            m.set('position', pos);
            const pm = new Y.Map();
            for (const [k, v] of Object.entries(node.params)) pm.set(k, v);
            m.set('params', pm);
            nodes.push([m]);
          });
        },
        deleteNode(nodeId) {
          doc.transact(() => {
            const i = findNodeIdx(nodeId);
            if (i !== -1) nodes.delete(i, 1);
          });
        },
        moveNode(nodeId, x, y) {
          doc.transact(() => {
            const i = findNodeIdx(nodeId);
            if (i === -1) return;
            const m = nodes.get(i);
            const pos = m.get('position') ?? new Y.Map();
            pos.set('x', x);
            pos.set('y', y);
            if (!m.get('position')) m.set('position', pos);
          });
        },
        renameNode(nodeId, label) {
          doc.transact(() => {
            const i = findNodeIdx(nodeId);
            if (i === -1) return;
            nodes.get(i).set('label', label);
          });
        },
        updateNodeParams(nodeId, params) {
          doc.transact(() => {
            const i = findNodeIdx(nodeId);
            if (i === -1) return;
            const m = nodes.get(i);
            const p = m.get('params') ?? new Y.Map();
            for (const [k, v] of Object.entries(params)) p.set(k, v);
            if (!m.get('params')) m.set('params', p);
          });
        },
        addEdge(edge) {
          doc.transact(() => {
            if (findEdgeIdx(edge.id) !== -1) return;
            const m = new Y.Map();
            m.set('id', edge.id);
            m.set('source', edge.source);
            m.set('target', edge.target);
            edges.push([m]);
          });
        },
        removeEdge(edgeId) {
          doc.transact(() => {
            const i = findEdgeIdx(edgeId);
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
            const label = String(m.get('label') ?? '');
            const pos = m.get('position');
            const px = pos && typeof pos.get === 'function' ? Number(pos.get('x') ?? 0) : 0;
            const py = pos && typeof pos.get === 'function' ? Number(pos.get('y') ?? 0) : 0;
            const pm = m.get('params');
            const params: Record<string, number | string> = {};
            if (pm && typeof pm.entries === 'function') {
              for (const [k, v] of pm.entries() as IterableIterator<[string, number | string]>) {
                params[k] = v;
              }
            }
            outNodes.push({ id: nid, label, position: { x: px, y: py }, params });
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
// PRNG — xorshift32, deterministic given a seed
// ---------------------------------------------------------------------------

function parseSeed(): number {
  const raw = process.env.SABFLOW_CONV_SEED ?? process.env.SABFLOW_CRDT_FUZZ_SEED;
  if (raw && raw.length > 0) {
    const n =
      raw.startsWith('0x') || raw.startsWith('0X')
        ? Number.parseInt(raw.slice(2), 16)
        : Number.parseInt(raw, 10);
    if (Number.isFinite(n) && n !== 0) return n >>> 0;
  }
  return ((Date.now() & 0xffffffff) | 1) >>> 0;
}

const SEED = parseSeed();

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
  nextInt(max: number): number {
    if (max <= 1) return 0;
    return this.next() % max;
  }
  pick<T>(arr: readonly T[]): T | undefined {
    if (arr.length === 0) return undefined;
    return arr[this.nextInt(arr.length)];
  }
}

function makeRng(label: string): Xorshift32 {
  let h = SEED >>> 0;
  for (let i = 0; i < label.length; i++) {
    h = (h ^ label.charCodeAt(i)) >>> 0;
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  if (h === 0) h = 1;
  return new Xorshift32(h);
}

// ---------------------------------------------------------------------------
// Backend resolution
// ---------------------------------------------------------------------------

let factory: ReplicaFactory = stubFactory;

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
    } else {
      throw new Error('yjs module missing required exports');
    }
  } catch {
    factory = stubFactory;
    process.stderr.write(
      `[sabflow crdt-convergence] yjs not available — using in-file stub CRDT\n`,
    );
  }
  process.stderr.write(
    `[sabflow crdt-convergence] seed=0x${SEED.toString(16).padStart(8, '0')} backend=${factory.backend}\n`,
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function canonicalize(s: CanonicalState): string {
  return stableStringify({
    nodes: s.nodes.map((n) => ({
      id: n.id,
      label: n.label,
      position: n.position,
      params: Object.fromEntries(
        Object.entries(n.params).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)),
      ),
    })),
    edges: s.edges.map((e) => ({ id: e.id, source: e.source, target: e.target })),
  });
}

/**
 * Merge docA into docB and docB into docA, then assert both are equal.
 * Returns the converged canonical string.
 */
function mergeAndAssert(docA: FuzzReplica, docB: FuzzReplica, ctx: string): string {
  // Exchange full state updates.
  const updateA = docA.encodeStateAsUpdate();
  const updateB = docB.encodeStateAsUpdate();
  docB.applyUpdate(updateA);
  docA.applyUpdate(updateB);

  const ca = canonicalize(docA.read());
  const cb = canonicalize(docB.read());
  const head = (s: string) => (s.length > 300 ? s.slice(0, 300) + '…' : s);
  assert.equal(
    ca,
    cb,
    `Replicas diverged after merge (${ctx})\n  A=${head(ca)}\n  B=${head(cb)}\n  REPRO: SABFLOW_CONV_SEED=0x${SEED.toString(16).padStart(8, '0')}`,
  );
  return ca;
}

// ---------------------------------------------------------------------------
// Test 1 — Property: two independent replicas with random ops converge
// ---------------------------------------------------------------------------

describe('CRDT convergence — two-replica property test', () => {
  it('random node-add / node-move / edge-add / edge-delete ops → both docs converge after merge', () => {
    const NUM_OPS = 120; // enough to hit multi-insert + delete cycles
    const rng = makeRng('prop-two-replica');

    const docA = factory.create('prop-A');
    const docB = factory.create('prop-B');

    // Local trackers so we generate meaningful ops (non-NOP moves/deletes).
    const aliveNodesA: string[] = [];
    const aliveEdgesA: string[] = [];
    const aliveNodesB: string[] = [];
    const aliveEdgesB: string[] = [];

    let nodeCounter = 0;
    let edgeCounter = 0;

    type OpKind = 'insertNode' | 'deleteNode' | 'moveNode' | 'addEdge' | 'removeEdge';

    function applyOneOp(
      doc: FuzzReplica,
      aliveNodes: string[],
      aliveEdges: string[],
      opIdx: number,
    ): void {
      const early = opIdx < NUM_OPS / 4;
      const bag: OpKind[] = ['insertNode', 'insertNode'];
      if (early) bag.push('insertNode');
      if (aliveNodes.length > 0) {
        bag.push('moveNode');
        if (!early) bag.push('deleteNode');
      }
      if (aliveNodes.length >= 2) bag.push('addEdge', 'addEdge');
      if (aliveEdges.length > 0 && !early) bag.push('removeEdge');

      const kind = rng.pick(bag)!;

      if (kind === 'insertNode') {
        const id = `n${nodeCounter++}`;
        doc.insertNode({
          id,
          label: `Node-${id}`,
          position: { x: rng.nextInt(800), y: rng.nextInt(600) },
          params: { type: `t${rng.nextInt(5)}` },
        });
        aliveNodes.push(id);
        return;
      }
      if (kind === 'deleteNode') {
        const id = rng.pick(aliveNodes)!;
        doc.deleteNode(id);
        const ni = aliveNodes.indexOf(id);
        if (ni !== -1) aliveNodes.splice(ni, 1);
        // Remove edges that reference this node from tracker.
        for (let i = aliveEdges.length - 1; i >= 0; i--) {
          // Edge ids encode nothing about endpoints in this test, so we
          // just leave them — after merge the deletion-vs-edit test
          // handles the orphan check specifically.
        }
        return;
      }
      if (kind === 'moveNode') {
        const id = rng.pick(aliveNodes)!;
        doc.moveNode(id, rng.nextInt(800), rng.nextInt(600));
        return;
      }
      if (kind === 'addEdge') {
        const src = rng.pick(aliveNodes)!;
        let tgt = rng.pick(aliveNodes)!;
        if (tgt === src && aliveNodes.length > 1) {
          tgt = aliveNodes[(aliveNodes.indexOf(src) + 1) % aliveNodes.length]!;
        }
        const id = `e${edgeCounter++}`;
        doc.addEdge({ id, source: src, target: tgt });
        aliveEdges.push(id);
        return;
      }
      if (kind === 'removeEdge') {
        const id = rng.pick(aliveEdges)!;
        doc.removeEdge(id);
        const ei = aliveEdges.indexOf(id);
        if (ei !== -1) aliveEdges.splice(ei, 1);
        return;
      }
    }

    // Apply ops independently on each replica.
    for (let i = 0; i < NUM_OPS; i++) {
      applyOneOp(docA, aliveNodesA, aliveEdgesA, i);
    }
    for (let i = 0; i < NUM_OPS; i++) {
      applyOneOp(docB, aliveNodesB, aliveEdgesB, i);
    }

    // Merge and assert convergence.
    mergeAndAssert(docA, docB, 'property-two-replica');
  });

  it('no-op merge: identical independent docs converge trivially', () => {
    const docA = factory.create('noop-A');
    const docB = factory.create('noop-B');
    // Insert the same node on both replicas concurrently (same id).
    docA.insertNode({ id: 'shared-1', label: 'Alpha', position: { x: 10, y: 20 }, params: {} });
    docB.insertNode({ id: 'shared-1', label: 'Alpha', position: { x: 10, y: 20 }, params: {} });
    mergeAndAssert(docA, docB, 'noop-merge');
    // Both should see exactly one node.
    const state = docA.read();
    assert.equal(state.nodes.length, 1, 'Expected exactly 1 node after no-op merge');
  });

  it('multiple rounds of random ops + incremental merges still converge', () => {
    const rng = makeRng('incremental-merge');
    const ROUNDS = 5;
    const OPS_PER_ROUND = 20;

    const docA = factory.create('inc-A');
    const docB = factory.create('inc-B');
    let nodeC = 0;
    let edgeC = 0;
    const nodesA: string[] = [];
    const nodesB: string[] = [];

    function addRandom(doc: FuzzReplica, aliveNodes: string[]): void {
      const id = `n${nodeC++}`;
      doc.insertNode({
        id,
        label: `L-${id}`,
        position: { x: rng.nextInt(500), y: rng.nextInt(500) },
        params: {},
      });
      aliveNodes.push(id);
      if (aliveNodes.length >= 2) {
        const src = rng.pick(aliveNodes)!;
        let tgt = rng.pick(aliveNodes)!;
        if (tgt === src && aliveNodes.length > 1)
          tgt = aliveNodes[(aliveNodes.indexOf(src) + 1) % aliveNodes.length]!;
        doc.addEdge({ id: `e${edgeC++}`, source: src, target: tgt });
      }
    }

    for (let round = 0; round < ROUNDS; round++) {
      for (let i = 0; i < OPS_PER_ROUND; i++) {
        addRandom(docA, nodesA);
        addRandom(docB, nodesB);
      }
      // Exchange incremental updates each round (mimics streaming sync).
      const svA = docA.encodeStateVector();
      const svB = docB.encodeStateVector();
      docA.applyUpdate(docB.encodeStateAsUpdate(svA));
      docB.applyUpdate(docA.encodeStateAsUpdate(svB));
    }

    // Final full convergence check.
    mergeAndAssert(docA, docB, 'incremental-merge-final');
  });
});

// ---------------------------------------------------------------------------
// Test 2 — Concurrent rename: two clients rename the same node differently
// ---------------------------------------------------------------------------

describe('CRDT convergence — concurrent node rename', () => {
  it('two concurrent renames → one wins deterministically, no crash', () => {
    const docA = factory.create('rename-A');
    const docB = factory.create('rename-B');

    // Both start with the same node inserted.
    const sharedNode: FuzzNode = {
      id: 'node-shared',
      label: 'Original',
      position: { x: 0, y: 0 },
      params: {},
    };
    docA.insertNode({ ...sharedNode });
    docB.insertNode({ ...sharedNode });

    // Sync the initial insert so both replicas know the node.
    docA.applyUpdate(docB.encodeStateAsUpdate());
    docB.applyUpdate(docA.encodeStateAsUpdate());

    // Now rename concurrently — neither has seen the other's rename yet.
    docA.renameNode('node-shared', 'Alpha-Name');
    docB.renameNode('node-shared', 'Beta-Name');

    // Merge.
    const converged = mergeAndAssert(docA, docB, 'concurrent-rename');

    // One name must have won; assert it is one of the two candidates.
    const state = docA.read();
    assert.equal(state.nodes.length, 1, 'Expected exactly one node after concurrent rename');
    const winnerLabel = state.nodes[0]!.label;
    assert.ok(
      winnerLabel === 'Alpha-Name' || winnerLabel === 'Beta-Name',
      `Expected winner to be one of the two rename candidates, got "${winnerLabel}"`,
    );

    // Sanity: the converged JSON must contain the winner label.
    assert.ok(
      converged.includes(winnerLabel),
      'Converged state must contain the winning label',
    );

    process.stderr.write(
      `[sabflow crdt-convergence] concurrent rename winner = "${winnerLabel}" (backend=${factory.backend})\n`,
    );
  });

  it('rename winner is stable across redundant re-deliveries', () => {
    const docA = factory.create('rename-stable-A');
    const docB = factory.create('rename-stable-B');

    const node: FuzzNode = { id: 'n-stable', label: 'Init', position: { x: 1, y: 2 }, params: {} };
    docA.insertNode({ ...node });
    docB.insertNode({ ...node });
    // Sync insert.
    docA.applyUpdate(docB.encodeStateAsUpdate());
    docB.applyUpdate(docA.encodeStateAsUpdate());

    docA.renameNode('n-stable', 'NameA');
    docB.renameNode('n-stable', 'NameB');

    const updateA = docA.encodeStateAsUpdate();
    const updateB = docB.encodeStateAsUpdate();

    // Apply each update multiple times (at-least-once delivery).
    for (let i = 0; i < 4; i++) {
      docA.applyUpdate(updateB);
      docB.applyUpdate(updateA);
    }

    const ca = canonicalize(docA.read());
    const cb = canonicalize(docB.read());
    assert.equal(ca, cb, 'Redundant deliveries must not destabilise the winner');

    // Re-applying after convergence must be a pure no-op.
    docA.applyUpdate(updateB);
    docB.applyUpdate(updateA);
    assert.equal(canonicalize(docA.read()), ca, 'Post-convergence apply must be idempotent');
    assert.equal(canonicalize(docB.read()), cb, 'Post-convergence apply must be idempotent');
  });
});

// ---------------------------------------------------------------------------
// Test 3 — Deletion-vs-edit conflict: no orphaned edges after merge
// ---------------------------------------------------------------------------

describe('CRDT convergence — deletion-vs-edit conflict', () => {
  it('one client deletes a node while another edits it → no orphaned edges after merge', () => {
    const docA = factory.create('delvsedit-A');
    const docB = factory.create('delvsedit-B');

    // Setup: both replicas start with two nodes and an edge between them.
    const nodeX: FuzzNode = { id: 'nx', label: 'NodeX', position: { x: 0, y: 0 }, params: { val: 1 } };
    const nodeY: FuzzNode = { id: 'ny', label: 'NodeY', position: { x: 100, y: 0 }, params: {} };
    const edge: FuzzEdge = { id: 'ex-to-y', source: 'nx', target: 'ny' };

    docA.insertNode({ ...nodeX });
    docA.insertNode({ ...nodeY });
    docA.addEdge({ ...edge });

    // Sync the setup to docB.
    docB.applyUpdate(docA.encodeStateAsUpdate());

    // Now partition: docA deletes nx AND its incident edge (standard editor
    // behaviour — the editor always cascades edge removal with node removal
    // in the same transaction, so docA removes both atomically).
    docA.removeEdge('ex-to-y'); // cascade: remove edges incident to nx
    docA.deleteNode('nx');

    // docB edits nx concurrently (it doesn't know nx was deleted on docA).
    docB.moveNode('nx', 200, 300);
    docB.updateNodeParams('nx', { val: 42, extra: 'hello' });
    // docB also adds a second edge from nx — this is the contested edge.
    docB.addEdge({ id: 'ex-to-y-2', source: 'nx', target: 'ny' });

    // Merge — both replicas must converge.
    const converged = mergeAndAssert(docA, docB, 'deletion-vs-edit');

    // After convergence: verify no orphaned edges.
    // An orphaned edge is one whose source or target node is NOT alive in the
    // final merged state. The CRDT itself does not cascade-delete edges when a
    // node is tombstoned, so the application layer (editor) is responsible for
    // doing that in the same transaction. Here docA did the cascade; docB did
    // not (it added new edges while unaware of the delete). The test asserts
    // that the final converged state has no orphaned edges — either because
    // the deletion won (nx is gone, edges referencing it are absent because
    // docA removed them), or because the edits won (nx survived, edges are
    // valid). Either outcome is acceptable; the key invariant is consistency.
    const state = docA.read();
    const liveNodeIds = new Set(state.nodes.map((n) => n.id));

    for (const e of state.edges) {
      assert.ok(
        liveNodeIds.has(e.source),
        `Orphaned edge "${e.id}": source node "${e.source}" is not alive in the merged state (live=${[...liveNodeIds].join(',')})`,
      );
      assert.ok(
        liveNodeIds.has(e.target),
        `Orphaned edge "${e.id}": target node "${e.target}" is not alive in the merged state (live=${[...liveNodeIds].join(',')})`,
      );
    }

    process.stderr.write(
      `[sabflow crdt-convergence] del-vs-edit: liveNodes=${[...liveNodeIds].join(',')} edges=${state.edges.map((e) => e.id).join(',') || '(none)'}\n`,
    );

    void converged;
  });

  it('cascading: delete both endpoints of an edge → no orphaned edges', () => {
    const docA = factory.create('cascade-A');
    const docB = factory.create('cascade-B');

    docA.insertNode({ id: 'ca', label: 'CA', position: { x: 0, y: 0 }, params: {} });
    docA.insertNode({ id: 'cb', label: 'CB', position: { x: 10, y: 0 }, params: {} });
    docA.addEdge({ id: 'e-ca-cb', source: 'ca', target: 'cb' });
    docB.applyUpdate(docA.encodeStateAsUpdate());

    // docA deletes both nodes (and their edge) in sequence.
    docA.deleteNode('ca');
    docA.deleteNode('cb');
    docA.removeEdge('e-ca-cb');

    // docB tries to move one of them concurrently.
    docB.moveNode('ca', 50, 50);

    mergeAndAssert(docA, docB, 'cascading-delete');

    const state = docA.read();
    const liveIds = new Set(state.nodes.map((n) => n.id));
    for (const e of state.edges) {
      assert.ok(
        liveIds.has(e.source),
        `Orphaned edge "${e.id}": source "${e.source}" not in live set`,
      );
      assert.ok(
        liveIds.has(e.target),
        `Orphaned edge "${e.id}": target "${e.target}" not in live set`,
      );
    }
  });

  it('edit-only conflict: two clients update different params of the same node → both survive', () => {
    const docA = factory.create('edit-only-A');
    const docB = factory.create('edit-only-B');

    const node: FuzzNode = {
      id: 'shared-node',
      label: 'Shared',
      position: { x: 5, y: 5 },
      params: { color: 'red', size: 10 },
    };
    docA.insertNode({ ...node });
    docB.applyUpdate(docA.encodeStateAsUpdate());

    // Two non-overlapping param updates concurrently.
    docA.updateNodeParams('shared-node', { color: 'blue' });
    docB.updateNodeParams('shared-node', { size: 99 });

    mergeAndAssert(docA, docB, 'edit-only-no-delete');

    // Both params must be present — no deletion occurred.
    const state = docA.read();
    assert.equal(state.nodes.length, 1, 'Node must survive pure-edit conflict');
    const params = state.nodes[0]!.params;
    assert.ok('color' in params, 'color param must be present');
    assert.ok('size' in params, 'size param must be present');
  });
});
