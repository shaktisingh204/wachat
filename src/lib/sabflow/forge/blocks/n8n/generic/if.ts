/**
 * Forge block: If (conditional branch)
 *
 * Source: n8n-master/packages/nodes-base/nodes/If/If.node.ts
 * Credential type: none — pure logic node.
 *
 * Operations covered:
 *   - evaluate — run a JavaScript expression against the current flow
 *     variables and emit `branch: 'true' | 'false'`.
 *
 * Out of scope: n8n's structured comparison builder (left/operator/right per
 * row) — deferred. Flow authors using this port write a one-line JS
 * expression instead, like `vars.status === 'paid' && vars.total > 0`.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function evaluate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const expr = asString(ctx.options.condition);
  if (!expr) throw new Error('If: condition expression is required');

  let result: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('vars', `"use strict"; return (${expr});`);
    result = fn(ctx.variables ?? {});
  } catch (err) {
    throw new Error(`If: failed to evaluate condition — ${(err as Error).message}`);
  }

  const branch = result ? 'true' : 'false';
  return {
    outputs: { branch, value: result },
    logs: [`If → ${branch}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_if',
  name: 'If',
  description: 'Branch the flow based on a JavaScript boolean expression.',
  iconName: 'LuGitBranch',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'evaluate',
      label: 'Evaluate condition',
      description:
        'Returns branch="true" or branch="false". Use the `vars` argument to read flow variables.',
      fields: [
        {
          id: 'condition',
          label: 'Condition (JavaScript expression)',
          type: 'code',
          required: true,
          placeholder: "vars.status === 'paid' && vars.total > 0",
          helperText: 'Receives `vars` — the current flow variables object.',
        },
      ],
      run: evaluate,
    },
  ],
};

registerForgeBlock(block);
export default block;
