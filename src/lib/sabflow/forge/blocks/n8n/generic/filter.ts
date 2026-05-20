/**
 * Forge block: Filter (per-item pass/fail routing)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Filter/Filter.node.ts (+ V1, V2)
 * Credential type: none — pure data transform.
 *
 * Operations covered:
 *   - filter — evaluate a JS predicate PER ITEM. Items the predicate returns
 *     truthy for go out the `pass` port; falsy items go out the `fail` port.
 *     Each downstream branch sees only the items routed to it (Phase 12.5
 *     per-item branching — same shape as the IF block).
 *
 * Out of scope:
 *   - n8n's structured comparison-row UI (a UX surface, not a runtime
 *     feature) — flow authors write a one-line JS predicate using `$json`
 *     for the current item and `vars` for flow variables.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

/** Compile the predicate ONCE per run instead of per item. New Function() is
 *  intentional — sandboxing matches n8n's eval semantics, and the executor's
 *  per-item iteration calls us repeatedly. */
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

async function filter(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const expr = asString(ctx.options.predicate);
  if (!expr) throw new Error('Filter: predicate expression is required');

  let fn: ReturnType<typeof compileCondition>;
  try {
    fn = compileCondition(expr);
  } catch (err) {
    throw new Error(`Filter: failed to compile predicate — ${(err as Error).message}`);
  }

  // One iteration sees one item. Always include BOTH ports in itemsByOutput
  // (empty array for the unchosen one) so executeFlow's branch lookup finds
  // them — a missing port would fall through to legacy single-stream routing.
  const vars = ctx.variables ?? {};
  const item = ctx.currentItem ?? {};
  let condResult: unknown;
  try {
    condResult = fn(vars, item);
  } catch (err) {
    throw new Error(`Filter: predicate threw — ${(err as Error).message}`);
  }
  const port: 'pass' | 'fail' = condResult ? 'pass' : 'fail';
  const opposite: 'pass' | 'fail' = port === 'pass' ? 'fail' : 'pass';

  return {
    outputs: { passed: Boolean(condResult), item },
    itemsByOutput: {
      [port]: [item],
      [opposite]: [],
    },
    selectedOutput: port,
    logs: [`Filter → ${port}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_filter',
  name: 'Filter',
  description: 'Route each item to `pass` or `fail` based on a JavaScript predicate.',
  iconName: 'LuFilter',
  category: 'Logic',
  // Two ports mirror IF — downstream blocks wire `outputs/main/0` to the
  // pass branch and `outputs/main/1` to the fail branch.
  outputs: [
    { name: 'pass', displayName: 'pass' },
    { name: 'fail', displayName: 'fail' },
  ],
  auth: { type: 'none' },
  actions: [
    {
      id: 'filter',
      label: 'Filter items',
      description: 'Predicate receives `$json` (current item) and `vars` (flow variables).',
      fields: [
        {
          id: 'predicate',
          label: 'Predicate (JavaScript)',
          type: 'code',
          required: true,
          placeholder: "$json.status === 'paid'",
          helperText: 'Truthy → `pass` port; falsy → `fail` port.',
        },
      ],
      run: filter,
    },
  ],
};

registerForgeBlock(block);
export default block;
