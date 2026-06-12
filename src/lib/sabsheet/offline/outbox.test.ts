/** Run: npx tsx --test src/lib/sabsheet/offline/outbox.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OfflineOutbox, MemoryOutboxStore, type FlushFn } from "./outbox.ts";
import { cmd } from "../commands/ops.ts";

const edit = (v = "x") => [cmd.setCell(0, 1, 1, v)];

function harness(opts?: { online?: boolean; flush?: FlushFn }) {
  const store = new MemoryOutboxStore();
  let online = opts?.online ?? true;
  const flushCalls: { id: number; size: number; baseSeq: number }[] = [];
  let snapshotCalls = 0;
  const states: string[] = [];
  const box = new OfflineOutbox({
    workbookId: "wb",
    store,
    isOnline: () => online,
    snapshot: async () => {
      snapshotCalls++;
      return new Uint8Array([snapshotCalls]);
    },
    // debounce disabled in tests — persistence is driven explicitly via flushNow()
    debounceMs: -1,
    flush:
      opts?.flush ??
      (async (b, baseSeq) => {
        flushCalls.push({ id: b.id, size: b.commands.length, baseSeq });
        return { seq: baseSeq + 1, rejected: false };
      }),
    onStateChange: (s) => states.push(s),
  });
  return {
    box,
    store,
    states,
    flushCalls,
    snapshotCalls: () => snapshotCalls,
    setOnline: (v: boolean) => (online = v),
  };
}

test("record() is non-blocking: no snapshot, no network until flushNow", async () => {
  const h = harness();
  h.box.record(edit());
  h.box.record(edit());
  // Nothing persisted yet — the interaction path must not pay for it.
  assert.equal(h.flushCalls.length, 0);
  assert.equal(h.snapshotCalls(), 0);
  assert.equal(await h.box.pendingCount(), 1); // buffered edits count as pending work
});

test("rapid edits coalesce into ONE batch + ONE snapshot", async () => {
  const h = harness();
  h.box.record(edit("a"));
  h.box.record(edit("b"));
  h.box.record(edit("c"));
  await h.box.flushNow();
  assert.equal(h.flushCalls.length, 1, "one server call for the burst");
  assert.equal(h.flushCalls[0].size, 3, "all three commands merged in order");
  assert.equal(h.snapshotCalls(), 1, "one snapshot for the burst");
  assert.equal(await h.box.pendingCount(), 0);
  assert.equal(await h.store.getSeq("wb"), 1);
});

test("offline: flushNow queues durably + caches the snapshot; reconnect drains in order", async () => {
  const h = harness({ online: false });
  h.box.record(edit("a"));
  await h.box.flushNow(); // commits buffer → queue, but network is down
  h.box.record(edit("b"));
  await h.box.flushNow();
  assert.equal(h.flushCalls.length, 0);
  assert.equal(await h.box.pendingCount(), 2);
  const cached = await h.box.cachedSnapshot();
  assert.ok(cached, "snapshot cached for offline restore");

  h.setOnline(true);
  await h.box.flush();
  assert.equal(h.flushCalls.length, 2);
  assert.deepEqual(h.flushCalls.map((c) => c.baseSeq), [0, 1], "ordered drain");
  assert.equal(await h.box.pendingCount(), 0);
});

test("conflict: rejected flush stops, edits stay queued, resolve clears", async () => {
  const h = harness({ flush: async () => ({ seq: 5, rejected: true }) });
  h.box.record(edit());
  await h.box.flushNow();
  assert.equal(h.states.at(-1), "conflict");
  assert.equal(await h.box.pendingCount(), 1);
  await h.box.resolveConflict(5);
  assert.equal(await h.box.pendingCount(), 0);
  assert.equal(await h.store.getSeq("wb"), 5);
});

test("network failure mid-drain keeps the rest queued", async () => {
  let calls = 0;
  const h = harness({
    flush: async (_b, baseSeq) => {
      calls++;
      if (calls === 2) throw new Error("dropped");
      return { seq: baseSeq + 1, rejected: false };
    },
  });
  h.box.record(edit("a"));
  await h.box.flushNow(); // batch 1 → ok
  h.box.record(edit("b"));
  await h.box.flushNow(); // batch 2 → network error, stays queued
  assert.equal(await h.box.pendingCount(), 1);
});

test("edits recorded during a persist are not lost", async () => {
  const h = harness();
  h.box.record(edit("a"));
  const p = h.box.flushNow();
  h.box.record(edit("late")); // lands in the buffer while persist is in flight
  await p;
  assert.equal(await h.box.pendingCount(), 1, "late edit still pending");
  await h.box.flushNow();
  assert.equal(await h.box.pendingCount(), 0);
  assert.equal(h.flushCalls.length, 2);
});
