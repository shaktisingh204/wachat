/**
 * Forge block: If (conditional branch)
 *
 * Source: n8n-master/packages/nodes-base/nodes/If/If.node.ts
 * Credential type: none — pure logic node.
 *
 * Operations covered:
 *   - evaluate — run a JavaScript expression against `vars` (flow variables)
 *     and `$json` (current item) and route the flow to the `true` or `false`
 *     output port (Phase 8 multi-output branching).
 *
 * Out of scope:
 *   - n8n's structured comparison builder (left/operator/right per row) — a
 *     UX surface; flow authors write a one-line JS expression instead, like
 *     `vars.status === 'paid' && vars.total > 0`.
 *   - Per-item branching (some items go true, others false in the same run).
 *     Blocked on sabflow Phase 9 paired-item ancestry tracking.
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
    // `$json` exposed alongside `vars` so authors can mix per-item and
    // flow-wide state in the same expression. The eval scope is restricted
    // to these two arguments — no implicit globals leak in.
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function(
      'vars',
      '$json',
      `"use strict"; return (${expr});`,
    );
    result = fn(ctx.variables ?? {}, ctx.currentItem ?? {});
  } catch (err) {
    throw new Error(`If: failed to evaluate condition — ${(err as Error).message}`);
  }

  const branch = result ? 'true' : 'false';
  return {
    outputs: { branch, value: result },
    selectedOutput: branch,
    logs: [`If → ${branch}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_if',
  name: 'If',
  description: 'Branch the flow based on a JavaScript boolean expression.',
  iconName: 'LuGitBranch',
  category: 'Logic',
  // Two output ports — wire the editor's `outputs/main/0` edge to the
  // success branch and `outputs/main/1` to the fallback branch.
  outputs: [
    { name: 'true', displayName: 'true' },
    { name: 'false', displayName: 'false' },
  ],
  auth: { type: 'none' },
  actions: [
    {
      id: 'evaluate',
      label: 'Evaluate condition',
      description:
        'Routes to the `true` or `false` output. Use `vars` for flow variables and `$json` for the current item.',
      fields: [
        {
          id: 'condition',
          label: 'Condition (JavaScript expression)',
          type: 'code',
          required: true,
          placeholder: "vars.status === 'paid' && $json.total > 0",
          helperText:
            'Receives `vars` (flow variables) and `$json` (current item).',
        },
      ],
      run: evaluate,
    },
  ],
};

registerForgeBlock(block);
export default block;
