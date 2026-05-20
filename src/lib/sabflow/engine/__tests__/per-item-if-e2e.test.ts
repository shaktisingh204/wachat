/**
 * Phase 12 E2E — IF block iterates upstream items per-item and emits
 * `itemsByOutput` so executeBlock buckets each item into the matching
 * port. Verifies the full data shape that downstream blocks would see.
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/per-item-if-e2e.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type { ForgeActionResult } from '@/lib/sabflow/forge/types';

// We can't import the real `forge_if` block here without pulling in the
// whole `server-only` chain that the forge registry triggers. The test
// instead replicates the action's run() inline — same code path that
// landed in src/lib/sabflow/forge/blocks/n8n/generic/if.ts.

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

async function runIf(
  expr: string,
  variables: Record<string, unknown>,
  currentItem: Record<string, unknown>,
): Promise<ForgeActionResult> {
  const fn = compileCondition(expr);
  const condResult = fn(variables, currentItem);
  const branch: 'true' | 'false' = condResult ? 'true' : 'false';
  return {
    outputs: { branch, value: condResult, item: currentItem },
    itemsByOutput: {
      [branch]: [currentItem],
      [branch === 'true' ? 'false' : 'true']: [],
    },
    selectedOutput: branch,
  };
}

/* ── per-item branching ─────────────────────────────────────────────────── */

test('IF emits itemsByOutput shape — each iteration tags one item', async () => {
  const r = await runIf('$json.score > 5', {}, { id: 'a', score: 9 });
  assert.equal(r.selectedOutput, 'true');
  assert.deepEqual(r.itemsByOutput, {
    true: [{ id: 'a', score: 9 }],
    false: [],
  });
});

test('IF: falsy condition routes the item to the false port', async () => {
  const r = await runIf('$json.score > 5', {}, { id: 'a', score: 3 });
  assert.equal(r.selectedOutput, 'false');
  assert.deepEqual(r.itemsByOutput, {
    true: [],
    false: [{ id: 'a', score: 3 }],
  });
});

test('Aggregated across 3 iterations, items split between branches', async () => {
  // Mirrors what executeBlock's iteration loop does:
  //   collectedBranches[port].push(...result.itemsByOutput[port])
  // We simulate the aggregation here to assert the final shape downstream
  // would see.
  const items = [
    { id: 'a', score: 9 },
    { id: 'b', score: 1 },
    { id: 'c', score: 7 },
    { id: 'd', score: 2 },
  ];

  const collected: Record<string, Array<Record<string, unknown>>> = {};
  for (const item of items) {
    const r = await runIf('$json.score > 5', {}, item);
    for (const [port, portItems] of Object.entries(r.itemsByOutput ?? {})) {
      if (!collected[port]) collected[port] = [];
      collected[port].push(...portItems);
    }
  }

  assert.deepEqual(collected.true, [
    { id: 'a', score: 9 },
    { id: 'c', score: 7 },
  ]);
  assert.deepEqual(collected.false, [
    { id: 'b', score: 1 },
    { id: 'd', score: 2 },
  ]);
});

test('IF reads vars alongside $json', async () => {
  // Common pattern: combine flow-wide vars + per-item fields in one condition.
  const r = await runIf(
    'vars.tier === "premium" && $json.total > 100',
    { tier: 'premium' },
    { total: 150 },
  );
  assert.equal(r.selectedOutput, 'true');
});

/* ── compile-time error surface ─────────────────────────────────────────── */

test('IF throws a useful error when condition has a syntax error', () => {
  assert.throws(
    () => compileCondition('vars.x ==='), // unterminated
    /(Unexpected|Invalid|SyntaxError)/,
  );
});
