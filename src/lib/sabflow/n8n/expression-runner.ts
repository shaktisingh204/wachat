/**
 * Sabflow ↔ n8n expression-engine bridge.
 *
 * The first practical payoff of the n8n port: any sabflow template that
 * uses `{{ ... }}` substitution can now be evaluated by n8n's full
 * Expression engine — `$json`, `$vars`, `$now`, `$today`, `$workflow`,
 * helper methods (`.toUpperCase()`, `.first()`, `.last()`, `.keys()`),
 * Luxon-powered date math, JMESPath, etc.
 *
 * Use `evaluateExpression()` for a single template; use
 * `resolveValue()` when you have a parameter object (string, number, array,
 * or nested record) and want every leaf string evaluated recursively.
 *
 * **Note** — by default this runs n8n's *legacy* (non-isolated-vm) engine
 * because it's safe and dependency-light. Call
 * `Expression.initExpressionEngine({ engine: 'vm', … })` once at boot to
 * upgrade to the sandboxed isolate engine bundled with
 * `@n8n/expression-runtime`.
 */
import type { SabFlowDoc } from '@/lib/sabflow/types';
import type {
  IWorkflowDataProxyData,
  INode,
  ITaskDataConnections,
  INodeExecutionData,
} from './interfaces';
import type { IRunExecutionData } from './run-execution-data/run-execution-data';
import { DateTime } from 'luxon';
import { Expression } from './expression';
import { buildN8nWorkflow } from './adapter';

/* ── Public types ───────────────────────────────────────────────────────── */

export type ExpressionContext = {
  /** `$json` — current item payload available inside expressions. */
  json?: Record<string, unknown>;
  /** `$vars` / `$variables` — sabflow variables resolved to their runtime values. */
  variables?: Record<string, unknown>;
  /** Override timezone used by Luxon-powered helpers. Defaults to `UTC`. */
  timezone?: string;
  /** When set, exposes `$workflow` based on the sabflow doc. */
  flow?: SabFlowDoc;
  /** Override the "current node" in `$node` — defaults to a synthetic stub. */
  currentNodeName?: string;
};

/* ── Internal data-proxy builder ────────────────────────────────────────── */

/**
 * Build the minimal `IWorkflowDataProxyData` payload n8n's
 * `Expression.resolveSimpleParameterValue` needs. Most fields are stubbed
 * because we are evaluating a single template, not a multi-node run — n8n
 * only reads what the template actually references.
 */
function buildProxyData(ctx: ExpressionContext): IWorkflowDataProxyData {
  const json = ctx.json ?? {};
  const items: INodeExecutionData[] = [{ json: json as INodeExecutionData['json'] }];

  const stubNode: INode = {
    id: 'sabflow.expression',
    name: ctx.currentNodeName ?? 'sabflow',
    typeVersion: 1,
    type: 'sabflow.expression',
    position: [0, 0],
    parameters: {},
  };

  const stubConnectionData: ITaskDataConnections = {
    main: [items],
  };

  const stubRunExecutionData = {
    resultData: { runData: {} },
    executionData: {
      contextData: {},
      nodeExecutionStack: [],
      metadata: {},
      waitingExecution: {},
      waitingExecutionSource: {},
    },
  } as unknown as IRunExecutionData;

  return {
    $json: json,
    $vars: ctx.variables ?? {},
    $variables: ctx.variables ?? {},
    $env: {},
    $secrets: {},
    $now: DateTime.now().setZone(ctx.timezone ?? 'UTC'),
    $today: DateTime.now().setZone(ctx.timezone ?? 'UTC').startOf('day'),
    $execution: { id: 'sabflow.preview', mode: 'manual' },
    $workflow: ctx.flow
      ? { id: ctx.flow._id?.toString() ?? ctx.flow.name, name: ctx.flow.name, active: ctx.flow.status === 'PUBLISHED' }
      : { id: 'sabflow.preview', name: 'sabflow', active: false },
    $node: { name: stubNode.name },
    $item: () => stubConnectionData,
    $items: () => items,
    $runIndex: 0,
    $thisItem: items[0],
    $thisItemIndex: 0,
    $thisRunIndex: 0,
    runIndex: 0,
    runExecutionData: stubRunExecutionData,
    workflow: ctx.flow ? buildN8nWorkflow(ctx.flow) : undefined,
    activeNodeName: stubNode.name,
    connectionInputData: items,
    connectionInputSource: null,
    additionalKeys: {},
    executeData: { node: stubNode, data: stubConnectionData, source: null },
    selfData: {},
    contextNodeName: stubNode.name,
    siblingParameters: {},
    mode: 'manual',
  } as unknown as IWorkflowDataProxyData;
}

/* ── Public API ─────────────────────────────────────────────────────────── */

/**
 * Evaluate a single sabflow template with the n8n expression engine.
 *
 * Sabflow uses `{{ expr }}` — n8n uses `={{ expr }}`.  We add the leading
 * `=` automatically when the template contains expression markers.
 *
 * @example
 *   evaluateExpression('Hello {{ $json.name }}!', { json: { name: 'Ada' } })
 *   // → 'Hello Ada!'
 *
 * @example
 *   evaluateExpression('{{ $now.toFormat("yyyy-MM-dd") }}')
 *   // → '2026-04-26'
 *
 * @example
 *   evaluateExpression('{{ $vars.tags.length }}', { variables: { tags: ['a','b'] } })
 *   // → 2
 */
export function evaluateExpression(
  template: string,
  ctx: ExpressionContext = {},
): unknown {
  if (typeof template !== 'string') return template;
  if (!template.includes('{{')) return template;

  const expr = new Expression(ctx.timezone ?? 'UTC');
  const data = buildProxyData(ctx);
  // n8n's expression syntax expects a leading `=` on values that should be
  // evaluated as expressions. Sabflow's existing `{{ var }}` templates omit
  // the prefix, so we add it here.
  const wrapped = template.startsWith('=') ? template : `=${template}`;
  return expr.resolveSimpleParameterValue(wrapped, data);
}

/**
 * Recursively evaluate every leaf string in `value` that contains `{{ }}`
 * markers.  Useful for resolving an entire `block.options` object before
 * passing it to a node executor.
 */
export function resolveValue<T>(value: T, ctx: ExpressionContext = {}): T {
  if (typeof value === 'string') {
    return evaluateExpression(value, ctx) as T;
  }
  if (Array.isArray(value)) {
    return value.map((item) => resolveValue(item, ctx)) as unknown as T;
  }
  if (value && typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      out[k] = resolveValue(v, ctx);
    }
    return out as T;
  }
  return value;
}
