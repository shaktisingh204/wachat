/**
 * Forge block: Function Item (deprecated, legacy n8n API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/FunctionItem/FunctionItem.node.ts
 *
 * Per-item variant of the legacy Function node. The snippet runs once per
 * item with `item` (a single record) in scope. Result is the array of
 * per-item return values.
 *
 * For new flows prefer `forge_code_n8n` looped via `forge_map` — kept here
 * for migration parity only.
 *
 * Operations covered:
 *   - run_per_item(code, items) → unknown[]
 *
 * Limitations / deferred:
 *   - n8n's `IExecuteFunctions` helpers are NOT exposed.
 *   - No sandbox isolation beyond `new Function(...)`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function parseItems(raw: unknown): unknown[] {
  let value: unknown = raw;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    try {
      value = JSON.parse(t);
    } catch (err) {
      throw new Error(`FunctionItem (legacy): items is not valid JSON — ${(err as Error).message}`);
    }
  }
  if (!Array.isArray(value)) throw new Error('FunctionItem (legacy): items must be an array');
  return value;
}

async function runPerItem(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const code = asString(ctx.options.code);
  if (!code) throw new Error('FunctionItem (legacy): code is required');
  const items = parseItems(ctx.options.items);

  let fn: (item: unknown, vars: Record<string, unknown>, index: number) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    fn = new Function('item', 'vars', 'index', `"use strict"; ${code}`) as typeof fn;
  } catch (err) {
    throw new Error(`FunctionItem (legacy): failed to compile — ${(err as Error).message}`);
  }

  const out: unknown[] = [];
  for (let i = 0; i < items.length; i++) {
    let result: unknown;
    try {
      result = fn(items[i], ctx.variables ?? {}, i);
      if (result && typeof (result as Promise<unknown>).then === 'function') {
        result = await result;
      }
    } catch (err) {
      throw new Error(`FunctionItem (legacy): item ${i} runtime error — ${(err as Error).message}`);
    }
    out.push(result);
  }

  return {
    outputs: { results: out, count: out.length },
    logs: [`FunctionItem (legacy) run_per_item → ${out.length} item(s)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_function_item_legacy',
  name: 'Function Item (legacy)',
  description: 'Deprecated FunctionItem node — runs a JS snippet once per item. Prefer `forge_code_n8n` + map for new flows.',
  iconName: 'LuFunctionSquare',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run_per_item',
      label: 'Run per item (legacy)',
      description: 'Snippet receives `item`, `vars`, `index`. Use `return ...;` to emit the per-item output.',
      fields: [
        {
          id: 'items',
          label: 'Items',
          type: 'json',
          required: true,
          placeholder: '[{"id":1},{"id":2}]',
          helperText: 'Array of items. Snippet runs once per element.',
        },
        {
          id: 'code',
          label: 'Code',
          type: 'code',
          required: true,
          placeholder: 'item.processed = true;\nreturn item;',
          helperText: 'Function body with `item`, `vars`, `index` in scope. Use `return` to emit a per-item value.',
        },
      ],
      run: runPerItem,
    },
  ],
};

registerForgeBlock(block);
export default block;
