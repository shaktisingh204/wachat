/**
 * Phase 12.5 E2E — Filter block matches IF's per-item branching shape.
 *
 * Filter is structurally identical to IF — predicate per item, two output
 * ports — so its emitted shape and aggregation behaviour need the same
 * downstream guarantees. We replicate the action inline (importing the
 * real `forge_filter` would pull the `server-only` registry chain).
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/per-item-filter-e2e.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { ForgeActionResult } from '@/lib/sabflow/forge/types';

function compileCondition(expr: string) {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(
    'vars',
    '$json',
    `"use strict"; return (${expr});`,
  ) as (
    vars: Record<string, unknown>,
    json: Record<string, unknown>,
  ) => unknown;
}

async function runFilter(
  expr: string,
  variables: Record<string, unknown>,
  currentItem: Record<string, unknown>,
): Promise<ForgeActionResult> {
  const fn = compileCondition(expr);
  const condResult = fn(variables, currentItem);
  const port: 'pass' | 'fail' = condResult ? 'pass' : 'fail';
  const opposite: 'pass' | 'fail' = port === 'pass' ? 'fail' : 'pass';
  return {
    outputs: { passed: Boolean(condResult), item: currentItem },
    itemsByOutput: {
      [port]: [currentItem],
      [opposite]: [],
    },
    selectedOutput: port,
  };
}

/* ── per-item branching ─────────────────────────────────────────────────── */

test('Filter emits pass/fail itemsByOutput shape per iteration', async () => {
  const r = await runFilter("$json.status === 'paid'", {}, { id: 1, status: 'paid' });
  assert.equal(r.selectedOutput, 'pass');
  assert.deepEqual(r.itemsByOutput, {
    pass: [{ id: 1, status: 'paid' }],
    fail: [],
  });
});

test('Filter routes falsy items to the fail port', async () => {
  const r = await runFilter("$json.status === 'paid'", {}, { id: 2, status: 'pending' });
  assert.equal(r.selectedOutput, 'fail');
  assert.deepEqual(r.itemsByOutput, {
    pass: [],
    fail: [{ id: 2, status: 'pending' }],
  });
});

test('Filter aggregation across N iterations splits items between ports', async () => {
  const items = [
    { id: 'a', status: 'paid' },
    { id: 'b', status: 'pending' },
    { id: 'c', status: 'paid' },
    { id: 'd', status: 'failed' },
  ];

  // Mirrors executeBlock's accumulator: per-iteration itemsByOutput is
  // concatenated by port across the run.
  const collected: Record<string, Array<Record<string, unknown>>> = {};
  for (const item of items) {
    const r = await runFilter("$json.status === 'paid'", {}, item);
    for (const [port, portItems] of Object.entries(r.itemsByOutput ?? {})) {
      if (!collected[port]) collected[port] = [];
      collected[port].push(...portItems);
    }
  }

  assert.deepEqual(collected.pass, [
    { id: 'a', status: 'paid' },
    { id: 'c', status: 'paid' },
  ]);
  assert.deepEqual(collected.fail, [
    { id: 'b', status: 'pending' },
    { id: 'd', status: 'failed' },
  ]);
});

test('Filter reads vars alongside $json (matches IF surface)', async () => {
  const r = await runFilter(
    'vars.minTotal !== undefined && $json.total >= vars.minTotal',
    { minTotal: 100 },
    { total: 150 },
  );
  assert.equal(r.selectedOutput, 'pass');
});

/* ── compile-time error surface ─────────────────────────────────────────── */

test('Filter surfaces predicate syntax errors at compile time', () => {
  assert.throws(
    () => compileCondition('$json.status =='), // unterminated comparison
    /(Unexpected|Invalid|SyntaxError)/,
  );
});
