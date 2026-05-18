/**
 * SabFlow — CRDT snapshot serialisation / deserialisation tests.
 *
 * C.8.8 — companion to `crdt-convergence.test.ts`.
 *
 * Verifies that a known Y.Doc state (or stub-CRDT state) can be:
 *   1. Encoded to `Uint8Array` via `encodeStateAsUpdate`.
 *   2. Serialised to a base64 string (the format used by
 *      `src/lib/sabflow/persistence/snapshot.ts` when writing to MongoDB's
 *      `sabflow_docs.snapshot` BSON Binary field).
 *   3. Decoded back from base64 to `Uint8Array`.
 *   4. Applied to a fresh empty doc.
 *   5. Assert that the hydrated doc's `read()` output is deeply equal to
 *      the original doc's `read()` output.
 *
 * Also tests incremental (delta) snapshots: encoding only the ops after a
 * given state-vector and applying them to a partial replica catches up
 * correctly.
 *
 * Run:
 *   npx tsx --test src/lib/sabflow/__tests__/crdt-snapshot.test.ts
 *
 * Dependencies: zero new deps. Uses the same StubReplica defined here;
 * falls back from yjs gracefully (same pattern as crdt-convergence.test.ts).
 */

import { strict as assert } from 'node:assert';
import { describe, it, before } from 'node:test';

// ---------------------------------------------------------------------------
// Re-use the same structural interfaces
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
// Stub CRDT (minimal copy — same semantics as crdt-convergence.test.ts)
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
  return a.r < b.r ? -1 : a.r > b.r ? 1 : 0;
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
  create(id) {
    return new StubReplica(id);
  },
};

// ---------------------------------------------------------------------------
// Real-yjs adapter
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
          if (m?.get?.('id') === nodeId) return i;
        }
        return -1;
      }
      function findEdgeIdx(edgeId: string): number {
        for (let i = 0; i < edges.length; i++) {
          const m = edges.get(i);
          if (m?.get?.('id') === edgeId) return i;
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
            const pos = nodes.get(i).get('position') ?? new Y.Map();
            pos.set('x', x);
            pos.set('y', y);
          });
        },
        renameNode(nodeId, label) {
          doc.transact(() => {
            const i = findNodeIdx(nodeId);
            if (i !== -1) nodes.get(i).set('label', label);
          });
        },
        updateNodeParams(nodeId, params) {
          doc.transact(() => {
            const i = findNodeIdx(nodeId);
            if (i === -1) return;
            const m = nodes.get(i);
            const p = m.get('params') ?? new Y.Map();
            for (const [k, v] of Object.entries(params)) p.set(k, v);
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
            if (!m?.get) continue;
            const pos = m.get('position');
            const pm = m.get('params');
            const params: Record<string, number | string> = {};
            if (pm?.entries) {
              for (const [k, v] of pm.entries() as IterableIterator<[string, number | string]>)
                params[k] = v;
            }
            outNodes.push({
              id: String(m.get('id') ?? ''),
              label: String(m.get('label') ?? ''),
              position: {
                x: Number(pos?.get?.('x') ?? 0),
                y: Number(pos?.get?.('y') ?? 0),
              },
              params,
            });
          }
          outNodes.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));

          const outEdges: FuzzEdge[] = [];
          for (let i = 0; i < edges.length; i++) {
            const m = edges.get(i);
            if (!m?.get) continue;
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
      `[sabflow crdt-snapshot] yjs not available — using in-file stub CRDT\n`,
    );
  }
  process.stderr.write(
    `[sabflow crdt-snapshot] backend=${factory.backend}\n`,
  );
});

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Encode a Uint8Array to base64 — matches Node.js Buffer.from(u8).toString('base64'). */
function toBase64(u8: Uint8Array): string {
  // Node.js: use Buffer for efficiency.
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(u8).toString('base64');
  }
  // Fallback: btoa over binary string.
  let bin = '';
  for (let i = 0; i < u8.length; i++) bin += String.fromCharCode(u8[i]!);
  return btoa(bin);
}

/** Decode a base64 string to Uint8Array. */
function fromBase64(b64: string): Uint8Array {
  if (typeof Buffer !== 'undefined') {
    return new Uint8Array(Buffer.from(b64, 'base64'));
  }
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return u8;
}

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

/** Build a "known" doc with a fixed, deterministic structure. */
function buildKnownDoc(): FuzzReplica {
  const doc = factory.create('snapshot-origin');

  doc.insertNode({
    id: 'alpha',
    label: 'Alpha Node',
    position: { x: 100, y: 200 },
    params: { type: 'http', timeout: 30 },
  });
  doc.insertNode({
    id: 'beta',
    label: 'Beta Node',
    position: { x: 300, y: 200 },
    params: { type: 'json' },
  });
  doc.insertNode({
    id: 'gamma',
    label: 'Gamma Node',
    position: { x: 200, y: 400 },
    params: { retries: 3, mode: 'strict' },
  });

  doc.addEdge({ id: 'e-alpha-beta', source: 'alpha', target: 'beta' });
  doc.addEdge({ id: 'e-beta-gamma', source: 'beta', target: 'gamma' });

  // A rename to confirm label round-trips.
  doc.renameNode('alpha', 'Alpha Node (renamed)');
  // A move to confirm position round-trips.
  doc.moveNode('gamma', 250, 450);
  // A param update.
  doc.updateNodeParams('beta', { extra: 'extra-val' });

  return doc;
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('CRDT snapshot — serialisation round-trip', () => {
  it('encodeStateAsUpdate → base64 → fromBase64 → applyUpdate restores identical structure', () => {
    const origin = buildKnownDoc();
    const expectedState = origin.read();
    const expected = canonicalize(expectedState);

    // Encode to bytes.
    const update = origin.encodeStateAsUpdate();
    assert.ok(update.length > 0, 'Update bytes must be non-empty');

    // Serialise to base64 (MongoDB Binary / R2 blob transport format).
    const b64 = toBase64(update);
    assert.ok(b64.length > 0, 'Base64 string must be non-empty');
    assert.ok(
      /^[A-Za-z0-9+/]+=*$/.test(b64),
      `Base64 string must be valid base64, got: ${b64.slice(0, 40)}`,
    );

    // Deserialise back to bytes.
    const restored = fromBase64(b64);
    assert.equal(
      restored.length,
      update.length,
      'Restored byte length must match original',
    );
    for (let i = 0; i < update.length; i++) {
      assert.equal(
        restored[i],
        update[i],
        `Byte mismatch at index ${i}: expected ${update[i]}, got ${restored[i]}`,
      );
    }

    // Apply to a fresh empty doc.
    const hydrated = factory.create('snapshot-hydrated');
    hydrated.applyUpdate(restored);

    const actual = canonicalize(hydrated.read());

    // Deep-equal assertion.
    assert.equal(
      actual,
      expected,
      `Hydrated doc state does not match origin.\n  expected: ${expected.slice(0, 300)}\n  actual:   ${actual.slice(0, 300)}`,
    );

    // Structural spot-checks.
    const hs = hydrated.read();
    assert.equal(hs.nodes.length, expectedState.nodes.length, 'Node count must match');
    assert.equal(hs.edges.length, expectedState.edges.length, 'Edge count must match');

    const alphaNode = hs.nodes.find((n) => n.id === 'alpha');
    assert.ok(alphaNode, '"alpha" node must be present after hydration');
    assert.equal(alphaNode!.label, 'Alpha Node (renamed)', '"alpha" label must be the renamed value');

    const gammaNode = hs.nodes.find((n) => n.id === 'gamma');
    assert.ok(gammaNode, '"gamma" node must be present after hydration');
    assert.equal(gammaNode!.position.x, 250, '"gamma" x must reflect the move op');
    assert.equal(gammaNode!.position.y, 450, '"gamma" y must reflect the move op');

    const betaNode = hs.nodes.find((n) => n.id === 'beta');
    assert.ok(betaNode, '"beta" node must be present after hydration');
    assert.equal(betaNode!.params['extra'], 'extra-val', '"beta" extra param must survive round-trip');

    process.stderr.write(
      `[sabflow crdt-snapshot] round-trip OK — ${hs.nodes.length} nodes, ${hs.edges.length} edges, update=${update.length}B b64=${b64.length}ch\n`,
    );
  });

  it('applying the same snapshot twice (idempotent re-apply) produces identical state', () => {
    const origin = buildKnownDoc();
    const expected = canonicalize(origin.read());

    const update = origin.encodeStateAsUpdate();
    const b64 = toBase64(update);
    const bytes = fromBase64(b64);

    const hydrated = factory.create('snapshot-idempotent');
    hydrated.applyUpdate(bytes);
    hydrated.applyUpdate(bytes); // re-apply
    hydrated.applyUpdate(bytes); // re-apply again

    assert.equal(
      canonicalize(hydrated.read()),
      expected,
      'Idempotent re-application must produce the same state',
    );
  });

  it('empty doc snapshot round-trips to empty state', () => {
    const origin = factory.create('empty-origin');
    const update = origin.encodeStateAsUpdate();
    const b64 = toBase64(update);
    const bytes = fromBase64(b64);

    const hydrated = factory.create('empty-hydrated');
    hydrated.applyUpdate(bytes);

    const hs = hydrated.read();
    assert.equal(hs.nodes.length, 0, 'Hydrated empty doc must have 0 nodes');
    assert.equal(hs.edges.length, 0, 'Hydrated empty doc must have 0 edges');
  });

  it('incremental (delta) snapshot: catch-up replica only receives new ops', () => {
    // Phase 1: build a doc and create a baseline snapshot.
    const origin = factory.create('delta-origin');

    origin.insertNode({
      id: 'v1-node',
      label: 'V1',
      position: { x: 0, y: 0 },
      params: { version: 1 },
    });
    origin.addEdge({ id: 'e-self', source: 'v1-node', target: 'v1-node' });

    // A "catch-up" replica applies the baseline.
    const catchUp = factory.create('delta-catchup');
    catchUp.applyUpdate(origin.encodeStateAsUpdate());

    // Capture the catch-up replica's state vector AFTER baseline.
    const svAfterBaseline = catchUp.encodeStateVector();

    // Phase 2: origin continues mutating.
    origin.insertNode({
      id: 'v2-node',
      label: 'V2',
      position: { x: 100, y: 0 },
      params: { version: 2 },
    });
    origin.addEdge({ id: 'e-v1-v2', source: 'v1-node', target: 'v2-node' });
    origin.renameNode('v1-node', 'V1 (updated)');

    // Encode only the delta since catch-up's baseline.
    const deltaUpdate = origin.encodeStateAsUpdate(svAfterBaseline);
    assert.ok(
      deltaUpdate.length > 0,
      'Delta update must be non-empty when there are new ops',
    );

    // The delta must be smaller than the full update (or equal in the worst
    // case for extremely compact encodings, but must not be larger).
    const fullUpdate = origin.encodeStateAsUpdate();
    assert.ok(
      deltaUpdate.length <= fullUpdate.length,
      `Delta (${deltaUpdate.length}B) must not exceed full update (${fullUpdate.length}B)`,
    );

    // Apply delta to catch-up replica.
    catchUp.applyUpdate(deltaUpdate);

    // Catch-up must now equal origin.
    const originCanon = canonicalize(origin.read());
    const catchUpCanon = canonicalize(catchUp.read());
    assert.equal(
      catchUpCanon,
      originCanon,
      `Delta catch-up failed.\n  expected: ${originCanon.slice(0, 300)}\n  actual:   ${catchUpCanon.slice(0, 300)}`,
    );

    const hs = catchUp.read();
    assert.equal(hs.nodes.length, 2, 'Catch-up replica must see both v1 and v2 nodes');

    process.stderr.write(
      `[sabflow crdt-snapshot] delta catch-up OK — full=${fullUpdate.length}B delta=${deltaUpdate.length}B\n`,
    );
  });

  it('snapshot captures deleted nodes correctly (tombstones survive round-trip)', () => {
    const origin = factory.create('tombstone-origin');

    origin.insertNode({ id: 'del-node', label: 'ToDelete', position: { x: 0, y: 0 }, params: {} });
    origin.insertNode({ id: 'keep-node', label: 'ToKeep', position: { x: 10, y: 0 }, params: {} });
    origin.addEdge({ id: 'e-keep-del', source: 'keep-node', target: 'del-node' });
    origin.deleteNode('del-node');
    origin.removeEdge('e-keep-del');

    const update = origin.encodeStateAsUpdate();
    const hydrated = factory.create('tombstone-hydrated');
    hydrated.applyUpdate(fromBase64(toBase64(update)));

    const hs = hydrated.read();
    // del-node must NOT appear (it was deleted).
    assert.ok(
      !hs.nodes.some((n) => n.id === 'del-node'),
      'Deleted node must not appear after hydration',
    );
    // keep-node must appear.
    assert.ok(
      hs.nodes.some((n) => n.id === 'keep-node'),
      'Kept node must appear after hydration',
    );
    // The edge referencing del-node must not appear.
    assert.ok(
      !hs.edges.some((e) => e.id === 'e-keep-del'),
      'Removed edge must not appear after hydration',
    );
  });
});
