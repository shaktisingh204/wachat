/** Run: npx tsx --test src/lib/sabsheet/offline/outbox.test.ts */
import { test } from "node:test";
import assert from "node:assert/strict";
import { OfflineOutbox, MemoryOutboxStore, type FlushFn } from "./outbox.ts";
import { cmd } from "../commands/ops.ts";

const snap = () => new Uint8Array([1, 2, 3]);
const edit = () => [cmd.setCell(0, 1, 1, "x")];

test("online: a recorded edit flushes immediately and advances seq", async () => {
  const store = new MemoryOutboxStore();
  let online = true;
  const sent: number[] = [];
  const flush: FlushFn = async (_b, baseSeq) => {
    sent.push(baseSeq);
    return { seq: baseSeq + 1, rejected: false };
  };
  const states: string[] = [];
  const box = new OfflineOutbox({
    workbookId: "wb",
    store,
    flush,
    isOnline: () => online,
    onStateChange: (s) => states.push(s),
  });

  await box.record(edit(), snap());
  assert.equal(await box.pendingCount(), 0);
  assert.equal(await store.getSeq("wb"), 1);
  assert.equal(states.at(-1), "synced");
});

test("offline: edits queue and the snapshot is cached locally", async () => {
  const store = new MemoryOutboxStore();
  let online = false;
  const flush: FlushFn = async () => {
    throw new Error("network down");
  };
  const box = new OfflineOutbox({ workbookId: "wb", store, flush, isOnline: () => online });

  await box.record(edit(), snap());
  await box.record(edit(), snap());
  assert.equal(await box.pendingCount(), 2);

  const cached = await box.cachedSnapshot();
  assert.deepEqual(cached?.bytes, snap());
});

test("reconnect: queued edits drain in order", async () => {
  const store = new MemoryOutboxStore();
  let online = false;
  const seenIds: number[] = [];
  const flush: FlushFn = async (b, baseSeq) => {
    seenIds.push(b.id);
    return { seq: baseSeq + 1, rejected: false };
  };
  const box = new OfflineOutbox({ workbookId: "wb", store, flush, isOnline: () => online });

  await box.record(edit(), snap());
  await box.record(edit(), snap());
  assert.equal(await box.pendingCount(), 2);

  online = true;
  await box.flush();
  assert.equal(await box.pendingCount(), 0);
  assert.deepEqual(seenIds, [1, 2]); // ordered
  assert.equal(await store.getSeq("wb"), 2);
});

test("conflict: a rejected flush stops draining and surfaces a conflict", async () => {
  const store = new MemoryOutboxStore();
  const flush: FlushFn = async () => ({ seq: 5, rejected: true });
  const states: string[] = [];
  const box = new OfflineOutbox({
    workbookId: "wb",
    store,
    flush,
    isOnline: () => true,
    onStateChange: (s) => states.push(s),
  });

  await box.record(edit(), snap());
  assert.equal(states.at(-1), "conflict");
  assert.equal(await box.pendingCount(), 1); // not dropped

  // Resolving re-bootstraps and clears the queue.
  await box.resolveConflict(5);
  assert.equal(await box.pendingCount(), 0);
  assert.equal(await store.getSeq("wb"), 5);
});

test("partial connectivity: network failure mid-drain keeps the rest queued", async () => {
  const store = new MemoryOutboxStore();
  let calls = 0;
  const flush: FlushFn = async (_b, baseSeq) => {
    calls++;
    if (calls === 2) throw new Error("dropped");
    return { seq: baseSeq + 1, rejected: false };
  };
  const box = new OfflineOutbox({ workbookId: "wb", store, flush, isOnline: () => true });

  await box.record(edit(), snap()); // flushes (call 1) ok
  await box.record(edit(), snap()); // flush call 2 throws -> stays queued
  assert.equal(await box.pendingCount(), 1);
});
