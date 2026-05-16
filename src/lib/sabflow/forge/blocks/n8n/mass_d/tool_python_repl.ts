/**
 * Forge block: Python REPL Tool (DISABLED)
 *
 * In LangChain ecosystems, the "Python REPL Tool" lets an agent execute
 * arbitrary Python on the host. We intentionally do NOT implement this in
 * SabFlow: the engine is a shared multi-tenant Node process and running
 * untrusted Python is a clear sandbox escape.
 *
 * This block exists so workflows that reference it surface a clear error
 * instead of "block not found", and so the docs/registry can point at the
 * recommended alternatives.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

const DISABLED_MESSAGE =
  'Python REPL is disabled on the SabFlow shared runtime. Use the HTTP block to call your own sandboxed runner (Vercel Sandbox, AWS Lambda, etc.) or move to a self-hosted SabFlow worker with `SABFLOW_ALLOW_REPL=1`.';

async function run(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const code = asString(ctx.options.code);
  return {
    outputs: { ok: false, error: DISABLED_MESSAGE, code },
    logs: [`Python REPL → DISABLED (${code.length} chars of code received)`],
  };
}

const block: ForgeBlock = {
  id: 'forge_tool_python_repl',
  name: 'Python REPL (disabled)',
  description: 'Placeholder for the LangChain Python REPL tool — disabled on the shared SabFlow runtime for safety.',
  iconName: 'LuShieldAlert',
  category: 'Integration',
  auth: { type: 'none' },
  actions: [
    {
      id: 'exec',
      label: 'Execute Python (disabled)',
      description: 'Returns a clear error so workflows surface why the tool is unavailable.',
      fields: [
        {
          id: 'code',
          label: 'Python code',
          type: 'code',
          placeholder: 'print("hello")',
          helperText: 'Execution is intentionally disabled — see block description.',
        },
      ],
      run,
    },
  ],
};

registerForgeBlock(block);
export default block;
