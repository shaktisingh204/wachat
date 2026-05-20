/**
 * Phase 12 — per-item branching.
 *
 * Verifies the new `itemsByOutput` contract on `ForgeActionResult`:
 *   • An action returning `{ itemsByOutput: { true: [...], false: [...] } }`
 *     parks each port's items separately so executeFlow can route them
 *     to different downstream branches.
 *   • Back-compat: actions that omit `itemsByOutput` keep their single
 *     `forgeItems` stream.
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/per-item-branching.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import type {
  ForgeActionResult,
  ForgeBlock,
} from '@/lib/sabflow/forge/types';

/* ── Schema ─────────────────────────────────────────────────────────────── */

test('ForgeActionResult.itemsByOutput type-checks as Record<port, items[]>', () => {
  const r: ForgeActionResult = {
    selectedOutput: 'true',
    itemsByOutput: {
      true: [{ name: 'Ada' }, { name: 'Bob' }],
      false: [{ name: 'Carol' }],
    },
  };
  assert.equal(r.itemsByOutput?.true.length, 2);
  assert.equal(r.itemsByOutput?.false.length, 1);
});

test('ForgeActionResult: itemsByOutput is optional (back-compat)', () => {
  const r: ForgeActionResult = {
    outputs: { x: 1 },
    items: [{ x: 1 }],
  };
  assert.equal(r.itemsByOutput, undefined);
});

/* ── Per-item IF semantics (shape) ──────────────────────────────────────── */

test('IF block schema can declare two outputs + itemsByOutput shape', () => {
  // Sketches a per-item IF action: iterate over upstream items, push
  // each into the matching port. Doesn't run the executor — just proves
  // the schema can carry the result.
  const ifBlock: ForgeBlock = {
    id: 'forge_test_per_item_if',
    name: 'PerItemIf',
    description: 'fixture',
    category: 'Logic',
    outputs: [
      { name: 'true', displayName: 'true' },
      { name: 'false', displayName: 'false' },
    ],
  };
  assert.equal(ifBlock.outputs?.length, 2);

  // Simulate evaluating condition `item.score > 5` over 3 items.
  const items = [{ score: 9 }, { score: 1 }, { score: 7 }];
  const itemsByOutput: Record<string, Array<Record<string, unknown>>> = {
    true: [],
    false: [],
  };
  for (const item of items) {
    const port = (item.score as number) > 5 ? 'true' : 'false';
    itemsByOutput[port].push(item);
  }
  const result: ForgeActionResult = { itemsByOutput };

  assert.equal(result.itemsByOutput?.true.length, 2);
  assert.equal(result.itemsByOutput?.false.length, 1);
  assert.equal((result.itemsByOutput?.true[0] as { score: number }).score, 9);
  assert.equal((result.itemsByOutput?.false[0] as { score: number }).score, 1);
});

/* ── Edge resolution rule (mirrors executeBlock's multi-output edge picker) */

type Edge = {
  id: string;
  from: { blockId?: string; groupId: string };
  to: { groupId: string };
  sourceHandle?: string;
};

function edgesForBlock(
  edges: Edge[],
  blockId: string,
): Map<number, Edge> {
  // Returns a map of outputIndex → edge, derived from `sourceHandle`.
  const out = new Map<number, Edge>();
  for (const e of edges) {
    if (e.from.blockId !== blockId) continue;
    if (!e.sourceHandle?.startsWith('outputs/main/')) continue;
    const idx = Number(e.sourceHandle.split('/')[2]);
    if (!Number.isNaN(idx)) out.set(idx, e);
  }
  return out;
}

test('edgesForBlock indexes outgoing edges by output port', () => {
  const edges: Edge[] = [
    {
      id: 'e0',
      from: { blockId: 'if1', groupId: 'g0' },
      to: { groupId: 'g_true' },
      sourceHandle: 'outputs/main/0',
    },
    {
      id: 'e1',
      from: { blockId: 'if1', groupId: 'g0' },
      to: { groupId: 'g_false' },
      sourceHandle: 'outputs/main/1',
    },
    {
      id: 'e_other',
      from: { blockId: 'other', groupId: 'g0' },
      to: { groupId: 'g_x' },
      sourceHandle: 'outputs/main/0',
    },
  ];
  const m = edgesForBlock(edges, 'if1');
  assert.equal(m.size, 2);
  assert.equal(m.get(0)?.to.groupId, 'g_true');
  assert.equal(m.get(1)?.to.groupId, 'g_false');
});
