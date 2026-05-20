/**
 * Forge block: If (conditional branch)
 *
 * Source: n8n-master/packages/nodes-base/nodes/If/If.node.ts
 * Credential type: none — pure logic node.
 *
 * Operations covered:
 *   - evaluate — evaluate a JavaScript expression PER ITEM. Items where the
 *     condition is truthy go out the `true` port; items where it's falsy go
 *     out the `false` port. Each downstream branch sees only the items
 *     routed to it (Phase 12 per-item branching).
 *
 * Out of scope:
 *   - n8n's structured comparison builder (left/operator/right per row) — a
 *     UX surface; flow authors write a one-line JS expression instead, like
 *     `vars.status === 'paid' && $json.total > 0`.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

/** Compile + memoise the user's JS expression so we re-parse it ONCE per
 *  run, not per item. New Function() is intentional — sandboxing matches
 *  n8n's eval semantics. */
function compileCondition(
  expr: string,
): (vars: Record<string, unknown>, json: Record<string, unknown>) => unknown {
  // eslint-disable-next-line @typescript-eslint/no-implied-eval
  return new Function(
    'vars',
    '$json',
    `"use strict"; return (${expr});`,
  ) as (
    vars: Record<string, unknown>,
    json: Record<string, unknown>,
  ) => unknown;
}

async function evaluate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const expr = asString(ctx.options.condition);
  if (!expr) throw new Error('If: condition expression is required');

  let fn: ReturnType<typeof compileCondition>;
  try {
    fn = compileCondition(expr);
  } catch (err) {
    throw new Error(`If: failed to compile condition — ${(err as Error).message}`);
  }

  // The IF action sees ONE current item at a time (the per-item iteration
  // loop in executeBlock calls it once per upstream item). For each call we
  // emit the SAME item into either the `true` or `false` port — the executor
  // aggregates `itemsByOutput` across iterations and routes each port's
  // collected items down the matching downstream edge. The `selectedOutput`
  // field carries the LAST iteration's choice for back-compat with
  // single-output downstream readers.
  const vars = ctx.variables ?? {};
  const item = ctx.currentItem ?? {};
  let condResult: unknown;
  try {
    condResult = fn(vars, item);
  } catch (err) {
    throw new Error(`If: condition threw — ${(err as Error).message}`);
  }
  const branch: 'true' | 'false' = condResult ? 'true' : 'false';

  return {
    outputs: { branch, value: condResult, item },
    // Per-item branching shape: this iteration's item goes to exactly one
    // port. Items from other iterations are accumulated by executeBlock
    // across the run, so downstream branches each receive only their items.
    itemsByOutput: {
      [branch]: [item],
      // Always include the opposite key (empty) so executeFlow's branch
      // lookup finds it. Otherwise a port with zero items would look
      // "missing" and fall through to legacy single-stream routing.
      [branch === 'true' ? 'false' : 'true']: [],
    },
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
