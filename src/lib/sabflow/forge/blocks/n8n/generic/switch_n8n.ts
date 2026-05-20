/**
 * Forge block: Switch (multi-way per-item branch)
 *
 * Source: n8n-master/packages/nodes-base/nodes/Switch/Switch.node.ts (+ V1..V3)
 * Credential type: none — pure logic node.
 *
 * Operations covered:
 *   - route — evaluate a JavaScript expression per item, match its stringified
 *     result against a list of rules, and route the item to the matching rule's
 *     output port (or `default` if no rule matches). Phase 12.5 per-item
 *     branching means each downstream branch sees only its bucket of items —
 *     the same shape IF and Filter emit, scaled to N ports.
 *
 * Fixed arity (v1): four configurable rule ports (`case_0`..`case_3`) plus a
 * `default` fallback. n8n V3 supports unbounded rules via `numberOutputs` —
 * we cap the first port for two reasons: (a) the editor needs a stable port
 * list at registration time, and (b) the engine's branch lookup is keyed by
 * port name. Lifting the cap requires dynamic-output support on ForgeBlock,
 * which is a separate piece of work.
 */
import { registerForgeBlock } from '../../../registry';
import type {
  ForgeActionContext,
  ForgeActionResult,
  ForgeBlock,
  ForgeKeyValuePair,
} from '../../../types';
import { asString } from '../_shared/http';

const PORTS = ['case_0', 'case_1', 'case_2', 'case_3'] as const;
type CasePort = (typeof PORTS)[number];
const FALLBACK = 'default' as const;

function compileExpression(
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

/** Read the configured rules from either a key/value list (key = match value,
 *  value = port name) OR a JSON array `[{value, output}]`. Empty values are
 *  skipped — they'd produce an unreachable rule. Unknown port names route to
 *  `default` rather than throwing, matching n8n's "Fallback Output" UX. */
function readRules(raw: unknown): Array<{ value: string; output: CasePort | typeof FALLBACK }> {
  const out: Array<{ value: string; output: CasePort | typeof FALLBACK }> = [];
  const valid = new Set<string>([...PORTS, FALLBACK]);

  const pushPair = (matchValue: string, port: string) => {
    if (!matchValue) return;
    const normalized = (valid.has(port) ? port : FALLBACK) as CasePort | typeof FALLBACK;
    out.push({ value: matchValue, output: normalized });
  };

  if (Array.isArray(raw)) {
    for (const entry of raw) {
      if (!entry || typeof entry !== 'object') continue;
      // Accept both shapes: a `key-value-list` row (`{key, value}`) and a
      // free-form `{value, output}` row from JSON.
      const e = entry as Partial<ForgeKeyValuePair> & {
        value?: unknown;
        output?: unknown;
      };
      if (typeof e.key === 'string' && typeof e.value === 'string') {
        pushPair(e.key, e.value);
      } else if (e.value !== undefined && e.output !== undefined) {
        pushPair(asString(e.value), asString(e.output));
      }
    }
    return out;
  }
  if (typeof raw === 'string') {
    const s = raw.trim();
    if (!s) return out;
    try {
      const parsed = JSON.parse(s);
      return readRules(parsed);
    } catch {
      return out;
    }
  }
  return out;
}

async function route(ctx: ForgeActionContext): Promise<ForgeActionResult> {
  const expr = asString(ctx.options.expression);
  if (!expr) throw new Error('Switch: expression is required');

  let fn: ReturnType<typeof compileExpression>;
  try {
    fn = compileExpression(expr);
  } catch (err) {
    throw new Error(`Switch: failed to compile expression — ${(err as Error).message}`);
  }

  const vars = ctx.variables ?? {};
  const item = ctx.currentItem ?? {};
  let raw: unknown;
  try {
    raw = fn(vars, item);
  } catch (err) {
    throw new Error(`Switch: expression threw — ${(err as Error).message}`);
  }
  const value = raw == null ? '' : String(raw);

  const rules = readRules(ctx.options.rules);
  // First-match wins — mirrors n8n. Falls through to `default` when no rule
  // matched, so downstream "catch-all" wiring stays consistent.
  const matched = rules.find((r) => r.value === value);
  const port: CasePort | typeof FALLBACK = matched ? matched.output : FALLBACK;

  // Always include EVERY declared port in itemsByOutput (empty for the ones
  // not chosen) so executeFlow's branch lookup finds them. A missing key on
  // a multi-output block would fall through to legacy single-stream routing
  // and silently merge branches.
  const itemsByOutput: Record<string, Array<Record<string, unknown>>> = {
    [FALLBACK]: [],
  };
  for (const p of PORTS) itemsByOutput[p] = [];
  itemsByOutput[port] = [item];

  return {
    outputs: { value, port, item },
    itemsByOutput,
    selectedOutput: port,
    logs: [`Switch → ${port}`],
  };
}

const block: ForgeBlock = {
  id: 'forge_switch_n8n',
  name: 'Switch (Legacy)',
  description: 'Route each item to one of up to four cases (or default) based on an expression.',
  iconName: 'LuRoute',
  category: 'Logic',
  auth: { type: 'none' },
  // Five fixed ports — `case_0..case_3` for configured rules + `default` for
  // the fallback. Editor wires `outputs/main/0..4` accordingly.
  outputs: [
    { name: 'case_0', displayName: 'case 0' },
    { name: 'case_1', displayName: 'case 1' },
    { name: 'case_2', displayName: 'case 2' },
    { name: 'case_3', displayName: 'case 3' },
    { name: FALLBACK, displayName: 'default' },
  ],
  actions: [
    {
      id: 'route',
      label: 'Route by case',
      description:
        'Evaluate an expression per item and route to the first matching rule (or `default`).',
      fields: [
        {
          id: 'expression',
          label: 'Expression (JavaScript)',
          type: 'code',
          required: true,
          placeholder: '$json.status',
          helperText:
            'Receives `vars` and `$json` (current item). Result is stringified before matching.',
        },
        {
          id: 'rules',
          label: 'Rules',
          // `key` = string the expression must equal; `value` = target port
          // (`case_0`..`case_3` or `default`). Unknown ports fall back to
          // `default` rather than blocking the run.
          type: 'key-value-list',
          helperText:
            'Each row: match value → output port. Ports: case_0, case_1, case_2, case_3, default.',
        },
      ],
      run: route,
    },
  ],
};

registerForgeBlock(block);
export default block;
