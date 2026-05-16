/**
 * Forge block: Switch (multi-way branch)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Switch/Switch.node.ts (+ V1..V3)
 * Credential type: none — pure logic node.
 *
 * Operations covered:
 *   - route — evaluate a JS expression and emit `branch: '<matched value>'`
 *     when the expression's result (stringified) matches one of the cases,
 *     else `branch: 'default'`.
 *
 * Out of scope: structured per-output rules with operator dropdowns — n8n's
 * V3 supports those, but this port keeps the surface tiny: one expression,
 * a comma-separated list of allowed cases, and a default branch.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

async function route(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const expr = asString(ctx.options.expression);
  if (!expr) throw new Error('Switch: expression is required');

  let raw: unknown;
  try {
    // eslint-disable-next-line @typescript-eslint/no-implied-eval
    const fn = new Function('vars', `"use strict"; return (${expr});`);
    raw = fn(ctx.variables ?? {});
  } catch (err) {
    throw new Error(`Switch: failed to evaluate expression — ${(err as Error).message}`);
  }

  const value = raw == null ? '' : String(raw);
  const cases = asString(ctx.options.cases)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const branch = cases.includes(value) ? value : 'default';
  return {
    outputs: { branch, value },
    logs: [`Switch → ${branch}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_switch_n8n',
  name: 'Switch (n8n)',
  description: 'Route the flow based on which case the expression matches.',
  iconName: 'LuRoute',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'route',
      label: 'Route by case',
      description: 'Evaluate an expression and pick a matching case or fall through to "default".',
      fields: [
        {
          id: 'expression',
          label: 'Expression (JavaScript)',
          type: 'code',
          required: true,
          placeholder: 'vars.status',
          helperText: 'Receives `vars`. Result is stringified before matching.',
        },
        {
          id: 'cases',
          label: 'Cases (comma-separated)',
          type: 'text',
          required: true,
          placeholder: 'paid, pending, failed',
        },
      ],
      run: route,
    },
  ],
};

registerForgeBlock(block);
export default block;
