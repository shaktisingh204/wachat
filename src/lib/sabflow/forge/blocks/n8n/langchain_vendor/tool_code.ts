/**
 * Forge block: LangChain Tool — Code
 *
 * Source: @n8n/nodes-langchain/nodes/tools/ToolCode/
 *
 * Run a JavaScript snippet that an LLM agent can invoke as a tool. Mirrors
 * `generic/code.ts` but receives a single `input` string (the tool argument)
 * and returns whatever the snippet returns, coerced to a string for the
 * tool-call response.
 *
 * No sandbox isolation beyond `new Function`. Only run snippets authored by
 * trusted users (plan-gated by the SabFlow engine).
 */

import { registerForgeBlock } from '../../../registry';
import type { ForgeActionContext, ForgeActionResult, ForgeBlock } from '../../../types';
import { asString } from '../_shared/http';

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const code = asString(ctx.options.code);
  const input = asString(ctx.options.input);
  if (!code) throw new Error('Code Tool: code is required');

  let fn: (input: string, vars: Record<string, unknown>) => unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    fn = new Function('input', 'vars', `"use strict"; ${code}`) as typeof fn;
  } catch (err) {
    throw new Error(`Code Tool: failed to compile — ${(err as Error).message}`);
  }

  let result: unknown;
  try {
    result = fn(input, ctx.variables ?? {});
    if (result && typeof (result as Promise<unknown>).then === 'function') {
      result = await result;
    }
  } catch (err) {
    throw new Error(`Code Tool: runtime error — ${(err as Error).message}`);
  }

  const text =
    typeof result === 'string'
      ? result
      : result == null
        ? ''
        : (() => {
            try {
              return JSON.stringify(result);
            } catch {
              return String(result);
            }
          })();

  return {
    outputs: { result, text },
    logs: ['Code Tool run → ok'],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_code',
  name: 'LangChain Tool — Code',
  description: 'Run a JavaScript snippet with a string `input` (tool-call shape).',
  iconName: 'LuCode',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'run',
      label: 'Run code',
      fields: [
        {
          id: 'code',
          label: 'Code',
          type: 'code',
          required: true,
          placeholder: 'return input.toUpperCase();',
          helperText: 'Body of a function with `input` (string) and `vars` (object) in scope.',
        },
        {
          id: 'input',
          label: 'Input',
          type: 'textarea',
          placeholder: 'value passed in as `input`',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
