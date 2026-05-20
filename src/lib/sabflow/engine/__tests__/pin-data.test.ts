/**
 * Phase 10 — pinData shape + run-from-here seeding.
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/pin-data.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { Block } from '@/lib/sabflow/types';

/* ── Schema: tightened pinData type-checks ──────────────────────────────── */

test('Block.pinData accepts { outputs }', () => {
  const b: Block = {
    id: 'b1',
    type: 'forge_test',
    groupId: 'g1',
    pinData: { outputs: { value: 'pinned' } },
  };
  assert.equal(b.pinData?.outputs?.value, 'pinned');
});

test('Block.pinData accepts { items }', () => {
  const b: Block = {
    id: 'b1',
    type: 'forge_test',
    groupId: 'g1',
    pinData: { items: [{ id: 1 }, { id: 2 }] },
  };
  assert.equal(b.pinData?.items?.length, 2);
});

test('Block.pinData accepts both outputs and items', () => {
  const b: Block = {
    id: 'b1',
    type: 'forge_test',
    groupId: 'g1',
    pinData: {
      outputs: { id: 1, label: 'first' },
      items: [{ id: 1, label: 'first' }, { id: 2, label: 'second' }],
    },
  };
  assert.equal(b.pinData?.outputs?.id, 1);
  assert.equal(b.pinData?.items?.length, 2);
});

test('Block without pinData is back-compat (existing blocks)', () => {
  const b: Block = {
    id: 'b1',
    type: 'forge_test',
    groupId: 'g1',
  };
  assert.equal(b.pinData, undefined);
});

/* ── runWithRetry: pinned short-circuit ────────────────────────────────── */

test('runWithRetry returns pinData verbatim, never invoking fn', async () => {
  const { runWithRetry } = await import('../runWithRetry');
  let called = 0;
  const block: Block = {
    id: 'b_pinned',
    type: 'forge_test',
    groupId: 'g1',
    pinData: { outputs: { value: 'pinned-result' } },
  };
  const out = await runWithRetry(block, async () => {
    called += 1;
    return { outputs: { value: 'should-not-run' } };
  });
  assert.equal(called, 0, 'fn must not be invoked when pinData is set');
  assert.equal(out.kind, 'ok');
  if (out.kind === 'ok') {
    assert.equal(out.pinned, true);
    assert.deepEqual(out.value, { outputs: { value: 'pinned-result' } });
    assert.equal(out.attempts, 0);
  }
});

test('runWithRetry: empty pinData object is still treated as pinned', async () => {
  // Defensive — `pinData: {}` would short-circuit too. n8n behaves the
  // same way: presence (not shape) of the pin is what suppresses execution.
  const { runWithRetry } = await import('../runWithRetry');
  let called = 0;
  const block: Block = {
    id: 'b1',
    type: 'forge_test',
    groupId: 'g1',
    pinData: {},
  };
  const out = await runWithRetry(block, async () => {
    called += 1;
    return { outputs: {} };
  });
  assert.equal(called, 0);
  assert.equal(out.kind === 'ok' && out.pinned, true);
});

test('runWithRetry: undefined pinData runs fn normally', async () => {
  const { runWithRetry } = await import('../runWithRetry');
  let called = 0;
  const block: Block = { id: 'b1', type: 'forge_test', groupId: 'g1' };
  const out = await runWithRetry(block, async () => {
    called += 1;
    return { outputs: { ok: true } };
  });
  assert.equal(called, 1);
  assert.equal(out.kind, 'ok');
});
