/** Run: npx tsx --test src/lib/sabsheet/collab/sync.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { RealtimeSync, type RemoteOp } from "./sync.ts";

function harness(opts: {
  ops: RemoteOp[];
  startSeq?: number;
  pending?: boolean;
  online?: boolean;
}) {
  let seq = opts.startSeq ?? 0;
  const applied: number[] = [];
  const sync = new RealtimeSync({
    isOnline: () => opts.online ?? true,
    hasPending: async () => opts.pending ?? false,
    getSeq: async () => seq,
    setSeq: async (s) => {
      seq = s;
    },
    fetchSince: async (since) => opts.ops.filter((o) => o.seq > since),
    applyRemote: async (d) => {
      applied.push(d[0]); // first byte tags the op for assertions
    },
  });
  return { sync, applied, getSeq: () => seq };
}

const op = (seq: number, tag: number): RemoteOp => ({ seq, diffs: new Uint8Array([tag]) });

test("applies new remote ops in order and advances seq", async () => {
  const h = harness({ ops: [op(1, 10), op(2, 20), op(3, 30)] });
  const n = await h.sync.poll();
  assert.equal(n, 3);
  assert.deepEqual(h.applied, [10, 20, 30]);
  assert.equal(h.getSeq(), 3);
});

test("only applies ops past the current seq", async () => {
  const h = harness({ ops: [op(1, 10), op(2, 20), op(3, 30)], startSeq: 2 });
  const n = await h.sync.poll();
  assert.equal(n, 1);
  assert.deepEqual(h.applied, [30]);
  assert.equal(h.getSeq(), 3);
});

test("defers while local edits are pending", async () => {
  const h = harness({ ops: [op(1, 10)], pending: true });
  assert.equal(await h.sync.poll(), 0);
  assert.deepEqual(h.applied, []);
});

test("skips while offline", async () => {
  const h = harness({ ops: [op(1, 10)], online: false });
  assert.equal(await h.sync.poll(), 0);
});

test("no-op when there is nothing new", async () => {
  const h = harness({ ops: [], startSeq: 5 });
  assert.equal(await h.sync.poll(), 0);
  assert.equal(h.getSeq(), 5);
});

test("onApplied fires once with the count and final seq", async () => {
  let seen: { count: number; seq: number } | null = null;
  let seq = 0;
  const sync = new RealtimeSync({
    isOnline: () => true,
    hasPending: async () => false,
    getSeq: async () => seq,
    setSeq: async (s) => {
      seq = s;
    },
    fetchSince: async () => [op(1, 1), op(2, 2)],
    applyRemote: async () => {},
    onApplied: (count, s) => {
      seen = { count, seq: s };
    },
  });
  await sync.poll();
  assert.deepEqual(seen, { count: 2, seq: 2 });
});
