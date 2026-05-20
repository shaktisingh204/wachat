/**
 * Phase 8 — multi-output branching: the IF block's selectedOutput drives
 * which downstream edge the executor follows.
 *
 * These tests are routing-shape unit tests: we exercise the IF action's
 * `run()` directly to verify it emits the right `selectedOutput`, and we
 * exercise the edge-resolution rule in isolation. End-to-end routing
 * through executeFlow needs a real flow doc which is too heavy for a unit
 * test — the production smoke test is the user clicking through a flow
 * with the IF block on canvas.
 *
 *   npx tsx --test src/lib/sabflow/engine/__tests__/multi-output-routing.test.ts
 */
import { strict as assert } from 'node:assert';
import { test } from 'node:test';

import { registerForgeBlock, getForgeBlock } from '@/lib/sabflow/forge/registry';
import type {
  ForgeBlock,
  ForgeAction,
  ForgeActionResult,
} from '@/lib/sabflow/forge/types';

/* ── Inline copy of the IF block's logic (no side-effect import) ────────── */

// Mirror the real IF block (`forge/blocks/n8n/generic/if.ts`). Inline so
// this test doesn't pull `forge/index.ts` which fails to load in node:test
// because it imports `server-only`.
const ifBlock: ForgeBlock = {
  id: 'forge_test_if_phase8',
  name: 'TestIf',
  description: 'fixture',
  category: 'Logic',
  outputs: [
    { name: 'true', displayName: 'true' },
    { name: 'false', displayName: 'false' },
  ],
  auth: { type: 'none' },
  actions: [
    {
      id: 'evaluate',
      label: 'Evaluate',
      fields: [
        { id: 'condition', label: 'Condition', type: 'code', required: true },
      ],
      run: async (ctx) => {
        const expr = String(ctx.options.condition ?? '');
        // eslint-disable-next-line @typescript-eslint/no-implied-eval
        const fn = new Function(
          'vars',
          '$json',
          `"use strict"; return (${expr});`,
        );
        const result = fn(ctx.variables ?? {}, ctx.currentItem ?? {});
        const branch: 'true' | 'false' = result ? 'true' : 'false';
        return {
          outputs: { branch, value: result },
          selectedOutput: branch,
        };
      },
    },
  ],
};
registerForgeBlock(ifBlock);

/* ── Selected-output behaviour ─────────────────────────────────────────── */

test('IF action returns selectedOutput="true" when condition is truthy', async () => {
  const block = getForgeBlock(ifBlock.id)!;
  const action = block.actions![0] as ForgeAction;
  const out = (await action.run({
    options: { condition: 'vars.x === 1' },
    variables: { x: 1 } as never,
  })) as ForgeActionResult;
  assert.equal(out.selectedOutput, 'true');
});

test('IF action returns selectedOutput="false" when condition is falsy', async () => {
  const block = getForgeBlock(ifBlock.id)!;
  const action = block.actions![0] as ForgeAction;
  const out = (await action.run({
    options: { condition: 'vars.x === 99' },
    variables: { x: 1 } as never,
  })) as ForgeActionResult;
  assert.equal(out.selectedOutput, 'false');
});

test('IF action reads $json (currentItem) alongside vars', async () => {
  const block = getForgeBlock(ifBlock.id)!;
  const action = block.actions![0] as ForgeAction;
  const out = (await action.run({
    options: { condition: '$json.score > 5' },
    variables: {} as never,
    currentItem: { score: 9 } as never,
  })) as ForgeActionResult;
  assert.equal(out.selectedOutput, 'true');

  const out2 = (await action.run({
    options: { condition: '$json.score > 5' },
    variables: {} as never,
    currentItem: { score: 1 } as never,
  })) as ForgeActionResult;
  assert.equal(out2.selectedOutput, 'false');
});

/* ── Edge-resolution rule ──────────────────────────────────────────────── */

type Edge = {
  id: string;
  from: { blockId?: string; groupId: string };
  to: { groupId: string };
  sourceHandle?: string;
};

function pickEdge(
  edges: Edge[],
  blockId: string,
  outputIndex: number,
): Edge | undefined {
  // Mirrors the rule in executeForgeBlock.
  const handle = `outputs/main/${outputIndex}`;
  return edges.find(
    (e) => e.from.blockId === blockId && e.sourceHandle === handle,
  );
}

test('edge picker selects the edge whose sourceHandle matches output index', () => {
  const edges: Edge[] = [
    {
      id: 'e_true',
      from: { blockId: 'b1', groupId: 'g0' },
      to: { groupId: 'g_true' },
      sourceHandle: 'outputs/main/0',
    },
    {
      id: 'e_false',
      from: { blockId: 'b1', groupId: 'g0' },
      to: { groupId: 'g_false' },
      sourceHandle: 'outputs/main/1',
    },
  ];
  assert.equal(pickEdge(edges, 'b1', 0)?.to.groupId, 'g_true');
  assert.equal(pickEdge(edges, 'b1', 1)?.to.groupId, 'g_false');
});

test('edge picker ignores edges from a different block', () => {
  const edges: Edge[] = [
    {
      id: 'e_other',
      from: { blockId: 'b_other', groupId: 'g0' },
      to: { groupId: 'g_x' },
      sourceHandle: 'outputs/main/0',
    },
  ];
  assert.equal(pickEdge(edges, 'b1', 0), undefined);
});

test('edge picker returns undefined when sourceHandle is missing', () => {
  // Legacy single-output blocks never set sourceHandle — they fall through
  // to sequential routing, NOT through the multi-output edge picker.
  const edges: Edge[] = [
    {
      id: 'e_legacy',
      from: { blockId: 'b1', groupId: 'g0' },
      to: { groupId: 'g_next' },
    },
  ];
  assert.equal(pickEdge(edges, 'b1', 0), undefined);
});
