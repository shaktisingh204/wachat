/**
 * SabFlow collab — two-user concurrent edit (integration test).
 *
 * Phase C.8 · sub-task #6 — "Playwright e2e" target. Playwright is not
 * installed in this repo, so per the sub-task brief we ship a smaller
 * integration test that exercises the same convergence guarantee at the
 * module level. See `./README.md` for the future-Playwright TODO.
 *
 *   npx tsx --test src/lib/sabflow/__tests__/e2e-collab/two-user-concurrent-edit.test.ts
 *
 * What's modeled here:
 *   • Two simulated clients (A & B) each maintain a local "doc" — a plain
 *     `Map<string, string>` whose keys correspond to SabFlow node ids.
 *     This mirrors the shape Yjs surfaces via `Y.Map`, and the oplog
 *     model that `src/lib/sabflow/persistence/oplog.ts` already persists
 *     (`{ docId, clientId, seq, update }`).
 *   • Each local edit produces an op `{ clientId, lamport, key, value }`.
 *     Ops are exchanged through a shared in-memory bus that mimics the
 *     `sabflow-ws` gateway broadcast path.
 *   • Convergence rule: last-writer-wins ordered by `(lamport, clientId)`.
 *     This is the CRDT property the future Yjs-backed Playwright test
 *     will assert on a real `Y.Doc` — the contract under test is "both
 *     clients see the same final state regardless of arrival order."
 *
 * The test deliberately injects out-of-order delivery (B sees A's op
 * AFTER its own concurrent op) and asserts both clients still converge.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

/* ── Minimal CRDT model ─────────────────────────────────────────────────── */

interface Op {
  clientId: string;
  lamport: number;
  key: string;
  value: string;
}

class Client {
  readonly id: string;
  private clock = 0;
  /** Highest lamport seen per key, used for LWW tie-breaking. */
  private heads = new Map<string, { lamport: number; clientId: string }>();
  readonly doc = new Map<string, string>();

  constructor(id: string) {
    this.id = id;
  }

  /** Local edit — returns the op to broadcast. */
  edit(key: string, value: string): Op {
    this.clock += 1;
    const op: Op = { clientId: this.id, lamport: this.clock, key, value };
    this.apply(op);
    return op;
  }

  /** Apply a remote (or self-echoed) op. Idempotent + commutative. */
  apply(op: Op): void {
    // Lamport clock advance.
    this.clock = Math.max(this.clock, op.lamport);
    const head = this.heads.get(op.key);
    if (
      !head ||
      op.lamport > head.lamport ||
      (op.lamport === head.lamport && op.clientId > head.clientId)
    ) {
      this.heads.set(op.key, { lamport: op.lamport, clientId: op.clientId });
      this.doc.set(op.key, op.value);
    }
  }
}

/** In-memory broadcast bus (stand-in for the sabflow-ws gateway). */
class Bus {
  private subs: Array<(op: Op) => void> = [];
  on(fn: (op: Op) => void): void {
    this.subs.push(fn);
  }
  send(op: Op): void {
    for (const fn of this.subs) fn(op);
  }
}

/* ── Tests ──────────────────────────────────────────────────────────────── */

test('two-user concurrent edit: both clients converge to the same state', () => {
  const a = new Client('user-a');
  const b = new Client('user-b');
  const bus = new Bus();
  bus.on((op) => {
    if (op.clientId !== a.id) a.apply(op);
    if (op.clientId !== b.id) b.apply(op);
  });

  // Sequential edits on different keys — trivially convergent.
  bus.send(a.edit('node-1', 'A1'));
  bus.send(b.edit('node-2', 'B1'));

  assert.equal(a.doc.get('node-1'), 'A1');
  assert.equal(a.doc.get('node-2'), 'B1');
  assert.equal(b.doc.get('node-1'), 'A1');
  assert.equal(b.doc.get('node-2'), 'B1');
});

test('two-user concurrent edit: concurrent writes to same key converge via LWW', () => {
  const a = new Client('user-a');
  const b = new Client('user-b');

  // Simulate concurrent edits BEFORE either has seen the other's op.
  const opA = a.edit('node-1', 'A-wins?');
  const opB = b.edit('node-1', 'B-wins?');

  // Now exchange — order should not matter.
  a.apply(opB);
  b.apply(opA);

  // Both clients must agree on the final value.
  assert.equal(
    a.doc.get('node-1'),
    b.doc.get('node-1'),
    'A and B must converge to the same value after exchanging concurrent ops',
  );

  // With equal lamport clocks and clientId tie-break, 'user-b' > 'user-a',
  // so B's write wins. (The test asserts the deterministic rule; whichever
  // direction the rule picks, BOTH clients must agree.)
  assert.equal(a.doc.get('node-1'), 'B-wins?');
});

test('two-user concurrent edit: out-of-order delivery still converges', () => {
  const a = new Client('user-a');
  const b = new Client('user-b');

  // A makes 3 edits; B makes 2 edits; B receives A's ops in reverse order.
  const a1 = a.edit('node-1', 'a1');
  const a2 = a.edit('node-2', 'a2');
  const a3 = a.edit('node-3', 'a3');
  const b1 = b.edit('node-2', 'b1'); // concurrent with a2
  const b2 = b.edit('node-4', 'b2');

  // Deliver to B in scrambled order.
  b.apply(a3);
  b.apply(a1);
  b.apply(a2);

  // Deliver to A in a different scrambled order.
  a.apply(b2);
  a.apply(b1);

  // Convergence check — keys must match across both clients.
  const keys = new Set([...a.doc.keys(), ...b.doc.keys()]);
  for (const k of keys) {
    assert.equal(
      a.doc.get(k),
      b.doc.get(k),
      `divergence on key '${k}': A=${a.doc.get(k)} B=${b.doc.get(k)}`,
    );
  }

  // node-2 has two concurrent writers (a2 vs b1) — assert LWW picks one
  // deterministically across both views.
  assert.ok(['a2', 'b1'].includes(a.doc.get('node-2') ?? ''));
  assert.equal(a.doc.get('node-2'), b.doc.get('node-2'));
});

test('two-user concurrent edit: rapid burst (50 ops) converges', () => {
  const a = new Client('user-a');
  const b = new Client('user-b');
  const pending: Op[] = [];

  for (let i = 0; i < 25; i++) {
    pending.push(a.edit(`k-${i % 7}`, `a-${i}`));
    pending.push(b.edit(`k-${i % 7}`, `b-${i}`));
  }

  // Shuffle deterministically (xorshift) and dispatch.
  let s = 0xdeadbeef;
  const shuffled = [...pending];
  for (let i = shuffled.length - 1; i > 0; i--) {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    const j = Math.abs(s) % (i + 1);
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  for (const op of shuffled) {
    if (op.clientId !== a.id) a.apply(op);
    if (op.clientId !== b.id) b.apply(op);
  }

  // Every key A has, B must have, and vice versa, with identical values.
  for (const [k, v] of a.doc) assert.equal(b.doc.get(k), v, `mismatch on ${k}`);
  for (const [k, v] of b.doc) assert.equal(a.doc.get(k), v, `mismatch on ${k}`);
});
