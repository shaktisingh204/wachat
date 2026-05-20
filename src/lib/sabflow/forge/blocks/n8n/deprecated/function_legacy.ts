/**
 * Forge block: Function (deprecated, legacy n8n API)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Function/Function.node.ts
 *
 * n8n's original `Function` node — predecessor to the modern `Code` node.
 * It received `items` (the full execution batch) as a single variable and
 * the user's snippet was expected to return a new `items` array.
 *
 * For new flows prefer `forge_code_n8n` (single `vars` surface) — kept here
 * for migration parity only.
 *
 * Operations covered:
 *   - run_legacy(code, items) → whatever the snippet returns
 *
 * Limitations / deferred:
 *   - n8n's `IExecuteFunctions` helpers ($items, $http, $node etc.) are NOT
 *     exposed. Only `items` (and `vars`) are visible to the snippet.
 *   - No sandbox isolation beyond `new Function(...)`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

function parseItems(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const t = raw.trim();
  if (!t) return [];
  try {
    return JSON.parse(t);
  } catch {
    return raw;
  }
}

async function runLegacy(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const code = asString(ctx.options.code);
  if (!code) throw new Error('Function (legacy): code is required');
  const items = parseItems(ctx.options.items);

  let fn: (items: unknown, vars: Record<string, unknown>) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    fn = new Function('items', 'vars', `"use strict"; ${code}`) as typeof fn;
  } catch (err) {
    throw new Error(`Function (legacy): failed to compile — ${(err as Error).message}`);
  }

  let result: unknown;
  try {
    result = fn(items, ctx.variables ?? {});
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      result = await result;
    }
  } catch (err) {
    throw new Error(`Function (legacy): runtime error — ${(err as Error).message}`);
  }

  return {
    outputs: { result },
    logs: ['Function (legacy) run_legacy → ok'],
  };
}

const block: ForgeBlock = {
  id: 'forge_function_legacy',
  name: 'Function (legacy)',
  description: 'Deprecated Function node — runs a JS snippet against the full `items` batch. Prefer `forge_code_n8n` for new flows.',
  iconName: 'LuFunctionSquare',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run_legacy',
      label: 'Run (legacy)',
      description: 'Snippet receives `items` (array) and `vars`. Use `return items;` to emit a transformed batch.',
      fields: [
        {
          id: 'items',
          label: 'Items',
          type: 'json',
          placeholder: '[{"json":{"id":1}}]',
          helperText: 'Array passed as `items` to the snippet. Defaults to [].',
        },
        {
          id: 'code',
          label: 'Code',
          type: 'code',
          required: true,
          placeholder: 'items.forEach(i => i.json.flag = true);\nreturn items;',
          helperText: 'Function body with `items` and `vars` in scope. Use `return` to emit a result.',
        },
      ],
      run: runLegacy,
    },
  ],
};

registerForgeBlock(block);
export default block;
