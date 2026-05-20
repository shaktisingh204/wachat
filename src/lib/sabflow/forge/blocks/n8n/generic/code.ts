/**
 * Forge block: Code (Run JavaScript)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Code/Code.node.ts
 * Credential type: none.
 *
 * Operations covered:
 *   - run_js — execute a JavaScript snippet against the current flow
 *     variables and emit whatever the snippet returns.
 *
 * Limitations (deferred):
 *   - Python mode is not ported (requires PyTaskRunner infrastructure).
 *   - n8n's full `IExecuteFunctions` (helpers, binary IO, $items, $http) is
 *     NOT exposed. The snippet receives just `vars` (current flow variables)
 *     and must return a plain JS value.
 *   - There is no sandbox isolation beyond `new Function(...)` — only run
 *     code authored by trusted users (plan-gated by the SabFlow engine).
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function runJs(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const code = asString(ctx.options.code);
  if (!code) throw new Error('Code: code is required');

  let fn: (vars: Record<string, unknown>) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    fn = new Function('vars', `"use strict"; ${code}`) as typeof fn;
  } catch (err) {
    throw new Error(`Code: failed to compile — ${(err as Error).message}`);
  }

  let result: unknown;
  try {
    result = fn(ctx.variables ?? {});
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      result = await result;
    }
  } catch (err) {
    throw new Error(`Code: runtime error — ${(err as Error).message}`);
  }

  return {
    outputs: { result },
    logs: ['Code run_js → ok'],
  };
}

const block: ForgeBlock = {
  id: 'forge_code_n8n',
  name: 'Code (Legacy)',
  description: 'Run a JavaScript snippet against the current flow variables.',
  iconName: 'LuCode',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run_js',
      label: 'Run JavaScript',
      description: 'Snippet receives `vars` and returns the output. Async (Promise) is awaited.',
      fields: [
        {
          id: 'code',
          label: 'Code',
          type: 'code',
          required: true,
          placeholder: 'return { upper: String(vars.name).toUpperCase() };',
          helperText: 'Body of a function with `vars` in scope. Use `return` to emit a result.',
        },
      ],
      run: runJs,
    },
  ],
};

registerForgeBlock(block);
export default block;
