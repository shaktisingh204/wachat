/**
 * Forge block: Evaluation (deprecated parity port)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Evaluation/Evaluation/Description.node.ts
 *
 * n8n's Evaluation node is a flow-evaluation harness that runs a list of
 * pass/fail predicates against an input and produces a verdict. SabFlow has
 * a richer native assertion surface (`assert`, `errorSignal`, condition
 * blocks); this block exists for migration parity only.
 *
 * Operations covered:
 *   - evaluate(input, criteria) → { passed, failed, score }
 *
 * Each criterion is a small object: `{ name, expr }` where `expr` is a JS
 * expression evaluated with `input` (and `vars`) in scope. A truthy result
 * counts as a pass.
 *
 * Limitations / deferred:
 *   - No metric tracking, no dataset-driven evaluation runs, no LLM judge.
 *   - There is no sandbox isolation beyond `new Function(...)`.
 */

import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
} from '../../../types';
import { asString } from '../_shared/http';

type Criterion = { name: string; expr: string };
type Verdict = { name: string; passed: boolean; error?: string };

function parseInput(raw: unknown): unknown {
  if (typeof raw !== 'string') return raw;
  const t = raw.trim();
  if (!t) return {};
  try {
    return JSON.parse(t);
  } catch {
    return raw;
  }
}

function parseCriteria(raw: unknown): Criterion[] {
  let value: unknown = raw;
  if (typeof value === 'string') {
    const t = value.trim();
    if (!t) return [];
    try {
      value = JSON.parse(t);
    } catch (err) {
      throw new Error(`Evaluation: criteria is not valid JSON — ${(err as Error).message}`);
    }
  }
  if (!Array.isArray(value)) throw new Error('Evaluation: criteria must be an array');
  return value.map((row, idx) => {
    if (!row || typeof row !== 'object') {
      throw new Error(`Evaluation: criteria[${idx}] must be an object`);
    }
    const r = row as Record<string, unknown>;
    const name = asString(r.name) || `criterion_${idx}`;
    const expr = asString(r.expr);
    if (!expr) throw new Error(`Evaluation: criteria[${idx}].expr is required`);
    return { name, expr };
  });
}

async function evaluate(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const input = parseInput(ctx.options.input);
  const criteria = parseCriteria(ctx.options.criteria);
  if (criteria.length === 0) {
    return {
      outputs: { passed: [], failed: [], score: 0 },
      logs: ['Evaluation evaluate → no criteria'],
    };
  }

  const passed: Verdict[] = [];
  const failed: Verdict[] = [];

  for (const c of criteria) {
    let fn: (input: unknown, vars: Record<string, unknown>) => unknown;
    try {
      // eslint-disable-next-line @typescript-eslint/no-implied-eval
      fn = new Function('input', 'vars', `"use strict"; return (${c.expr});`) as typeof fn;
    } catch (err) {
      failed.push({ name: c.name, passed: false, error: `compile: ${(err as Error).message}` });
      continue;
    }
    try {
      const result = fn(input, ctx.variables ?? {});
      if (result) passed.push({ name: c.name, passed: true });
      else failed.push({ name: c.name, passed: false });
    } catch (err) {
      failed.push({ name: c.name, passed: false, error: (err as Error).message });
    }
  }

  const score = passed.length / criteria.length;

  return {
    outputs: { passed, failed, score },
    logs: [`Evaluation evaluate → ${passed.length}/${criteria.length} passed (score=${score.toFixed(2)})`],
  };
}

const block: ForgeBlock = {
  id: 'forge_evaluation',
  name: 'Evaluation (legacy)',
  description: 'Run a list of pass/fail JS predicates against an input and return a verdict (migration parity only).',
  iconName: 'LuClipboardCheck',
  category: 'Logic',
  auth: { type: 'none' },
  actions: [
    {
      id: 'evaluate',
      label: 'Evaluate',
      description: 'Score `input` against an array of `{ name, expr }` criteria. `expr` is a JS expression with `input` and `vars` in scope.',
      fields: [
        {
          id: 'input',
          label: 'Input',
          type: 'json',
          placeholder: '{"reply":"ok","status":200}',
          helperText: 'Object or value to evaluate. Accessible as `input` inside each `expr`.',
        },
        {
          id: 'criteria',
          label: 'Criteria',
          type: 'json',
          required: true,
          placeholder: '[{"name":"is_ok","expr":"input.status === 200"}]',
          helperText: 'Array of `{ name, expr }`. `expr` is a JS expression returning truthy for pass.',
        },
      ],
      run: evaluate,
    },
  ],
};

registerForgeBlock(block);
export default block;
