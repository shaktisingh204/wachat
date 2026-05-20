/**
 * Forge block: Filter (filter an array of items)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Filter/Filter.node.ts (+ V1, V2)
 * Credential type: none — pure data transform.
 *
 * Operations covered:
 *   - filter — keep array items for which a JS predicate returns truthy
 *
 * Out of scope: n8n's structured comparison-row UI (a UX surface, not a
 * runtime feature) — flow authors write a one-line JS predicate using `item`
 * and `vars`. Per-item iteration would also need sabflow's run-once-per-item
 * engine mode (Phase 7+ — currently the engine runs each block exactly once
 * per execution), so we keep the single-array I/O shape.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function toArray(raw: unknown): unknown[] {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return [];
    try {
      const parsed = JSON.parse(s);
      return Array.isArray(parsed) ? parsed : [parsed];
    } catch (err) {
      throw new Error(`Filter: input is not a JSON array — ${(err as Error).message}`);
    }
  }
  if (raw == null) return [];
  return [raw];
}

async function filter(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const items = toArray(ctx.options.input);
  const expr = asString(ctx.options.predicate);
  if (!expr) throw new Error('Filter: predicate expression is required');

  let predicate: (item: unknown, vars: Record<string, unknown>) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    predicate = new Function('item', 'vars', `"use strict"; return (${expr});`) as typeof predicate;
  } catch (err) {
    throw new Error(`Filter: failed to compile predicate — ${(err as Error).message}`);
  }

  const result: unknown[] = [];
  for (const item of items) {
    try {
      if (predicate(item, ctx.variables ?? {})) result.push(item);
    } catch (err) {
      throw new Error(`Filter: predicate threw — ${(err as Error).message}`);
    }
  }

  return {
    outputs: { result, count: result.length },
    logs: [`Filter → kept ${result.length} of ${items.length}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_filter',
  name: 'Filter',
  description: 'Keep array items that satisfy a JavaScript predicate.',
  iconName: 'LuFilter',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'filter',
      label: 'Filter array',
      description: 'Predicate receives `item` (current element) and `vars` (flow variables).',
      fields: [
        {
          id: 'input',
          label: 'Input array',
          type: 'json',
          required: true,
          placeholder: '[ { "status": "paid" }, { "status": "pending" } ]',
        },
        {
          id: 'predicate',
          label: 'Predicate (JavaScript)',
          type: 'code',
          required: true,
          placeholder: "item.status === 'paid'",
        },
      ],
      run: filter,
    },
  ],
};

registerForgeBlock(block);
export default block;
