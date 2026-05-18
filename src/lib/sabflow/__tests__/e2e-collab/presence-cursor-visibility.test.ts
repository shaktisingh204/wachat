/**
 * SabFlow collab — presence cursor visibility (integration test).
 *
 * Phase C.8 · sub-task #6 — "Playwright e2e" target. See ./README.md for
 * the future-Playwright TODO. This test exercises the same SLO directly
 * against the production presence store.
 *
 *   npx tsx --test src/lib/sabflow/__tests__/e2e-collab/presence-cursor-visibility.test.ts
 *
 * SLO under test: a remote user's cursor MUST be visible to the
 * observing user within 500 ms of the remote heartbeat. The Playwright
 * spec will assert the same threshold against rendered DOM; here we
 * assert it against the store's read API which the renderer subscribes to.
 */

import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import {
  heartbeat,
  leave,
  listPresence,
  type PresenceEntry,
} from '../../presence/store';

const SLO_MS = 500;

function entry(userId: string, cursor: { x: number; y: number }): PresenceEntry {
  return { userId, name: userId, cursor, lastSeen: Date.now() };
}

test('presence cursor: remote user is visible to observer within 500ms', () => {
  const flowId = 'flow-presence-1';
  const userA = 'user-a';
  const userB = 'user-b';

  // A joins.
  heartbeat(flowId, entry(userA, { x: 0, y: 0 }));

  // B sends a heartbeat with a cursor.
  const t0 = Date.now();
  heartbeat(flowId, entry(userB, { x: 120, y: 240 }));

  // A queries presence (excluding self).
  const visible = listPresence(flowId, userA);
  const elapsed = Date.now() - t0;

  assert.ok(elapsed < SLO_MS, `presence read took ${elapsed}ms, SLO is ${SLO_MS}ms`);
  const remote = visible.find((p) => p.userId === userB);
  assert.ok(remote, 'user-a must see user-b in presence list');
  assert.deepEqual(remote!.cursor, { x: 120, y: 240 });

  // cleanup
  leave(flowId, userA);
  leave(flowId, userB);
});

test('presence cursor: cursor coordinates update on subsequent heartbeat', () => {
  const flowId = 'flow-presence-2';
  const userA = 'user-a';
  const userB = 'user-b';

  heartbeat(flowId, entry(userA, { x: 0, y: 0 }));
  heartbeat(flowId, entry(userB, { x: 10, y: 10 }));

  // B moves the cursor.
  const t0 = Date.now();
  heartbeat(flowId, entry(userB, { x: 999, y: 888 }));
  const observed = listPresence(flowId, userA).find((p) => p.userId === userB);
  const elapsed = Date.now() - t0;

  assert.ok(elapsed < SLO_MS, `cursor update propagation ${elapsed}ms exceeded SLO ${SLO_MS}ms`);
  assert.deepEqual(observed?.cursor, { x: 999, y: 888 });

  leave(flowId, userA);
  leave(flowId, userB);
});

test('presence cursor: observer never sees their own cursor in the others list', () => {
  const flowId = 'flow-presence-3';
  const userA = 'user-a';
  const userB = 'user-b';

  heartbeat(flowId, entry(userA, { x: 1, y: 1 }));
  heartbeat(flowId, entry(userB, { x: 2, y: 2 }));

  const aSees = listPresence(flowId, userA);
  assert.ok(!aSees.some((p) => p.userId === userA), 'observer must be excluded from list');
  assert.ok(aSees.some((p) => p.userId === userB));

  const bSees = listPresence(flowId, userB);
  assert.ok(!bSees.some((p) => p.userId === userB));
  assert.ok(bSees.some((p) => p.userId === userA));

  leave(flowId, userA);
  leave(flowId, userB);
});

test('presence cursor: leave() removes the entry instantly (< SLO)', () => {
  const flowId = 'flow-presence-4';
  const userA = 'user-a';
  const userB = 'user-b';

  heartbeat(flowId, entry(userA, { x: 0, y: 0 }));
  heartbeat(flowId, entry(userB, { x: 5, y: 5 }));

  const t0 = Date.now();
  leave(flowId, userB);
  const aSees = listPresence(flowId, userA);
  const elapsed = Date.now() - t0;

  assert.ok(elapsed < SLO_MS, `leave-propagation ${elapsed}ms exceeded SLO ${SLO_MS}ms`);
  assert.ok(!aSees.some((p) => p.userId === userB), 'user-b must disappear from presence');

  leave(flowId, userA);
});

test('presence cursor: heartbeat under load (10 users) all visible within SLO', () => {
  const flowId = 'flow-presence-5';
  const observer = 'observer';
  heartbeat(flowId, entry(observer, { x: 0, y: 0 }));

  const t0 = Date.now();
  for (let i = 0; i < 10; i++) {
    heartbeat(flowId, entry(`peer-${i}`, { x: i * 10, y: i * 20 }));
  }
  const others = listPresence(flowId, observer);
  const elapsed = Date.now() - t0;

  assert.ok(elapsed < SLO_MS, `bulk presence took ${elapsed}ms, SLO ${SLO_MS}ms`);
  assert.equal(others.length, 10);
  for (let i = 0; i < 10; i++) {
    const peer = others.find((p) => p.userId === `peer-${i}`);
    assert.ok(peer, `peer-${i} should be present`);
    assert.deepEqual(peer!.cursor, { x: i * 10, y: i * 20 });
  }

  // cleanup
  leave(flowId, observer);
  for (let i = 0; i < 10; i++) leave(flowId, `peer-${i}`);
});
