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
import { DateTime, Duration, Interval } from 'luxon';
import jmespath from 'jmespath';
import { Expression } from './expression';
import { buildN8nWorkflow } from './adapter';

/**
 * `$jmesPath(data, query)` — JMESPath query helper exposed to expressions.
 * Matches n8n's wrapper at `workflow-data-proxy.ts:1555` — accepts arbitrary
 * data + a query string, returns the JMESPath result, swallows errors so a
 * bad query doesn't crash the whole expression evaluation.
 */
function jmespathWrapper(data: unknown, query: unknown): unknown {
  if (typeof query !== 'string') return undefined;
  try {
    return jmespath.search(data as object, query);
  } catch {
    return undefined;
  }
}

/**
 * Walk a `pairedItem` chain back from the current iteration to the named
 * ancestor node and return THAT ancestor's contributing item.
 *
 * Algorithm: start at (currentNodeName, currentItemIndex). Read
 * `nodeOutputs[current].pairedItems[itemIndex]` to find which item of the
 * IMMEDIATE upstream produced us. Move to that upstream node (via its
 * stashed `prevNodeName`) and repeat until we either hit `target` or run
 * out of ancestry — in which case we return `undefined` (matches n8n's
 * permissive "missing ancestor" behaviour).
 *
 * Pure: never mutates the nodeOutputs map, never throws.
 */
function makeGetPairedItem(
  nodeOutputs: Record<string, unknown>,
  startNode: string | undefined,
  startItemIndex: number,
): (target: string) => Record<string, unknown> | undefined {
  return (target: string) => {
    if (!target || !startNode) return undefined;
    // Guard against pathological cycles in malformed graphs — bounded walk.
    const MAX_HOPS = 64;
    let currentName: string | undefined = startNode;
    let currentItem = startItemIndex;
    for (let hop = 0; hop < MAX_HOPS; hop++) {
      const entry = nodeOutputs[currentName] as
        | {
            items?: Array<Record<string, unknown>>;
            pairedItems?: Array<{ item: number; input?: number }>;
            prevNodeName?: string;
          }
        | undefined;
      if (!entry) return undefined;
      const paired = entry.pairedItems?.[currentItem];
      if (!paired || !entry.prevNodeName) return undefined;
      const upstreamName: string = entry.prevNodeName;
      const upstreamItemIdx = paired.item;
      if (upstreamName === target) {
        const upstream = nodeOutputs[target] as
          | { items?: Array<Record<string, unknown>>; json?: unknown }
          | undefined;
        if (!upstream) return undefined;
        return (
          upstream.items?.[upstreamItemIdx] ??
          (upstream.json as Record<string, unknown> | undefined)
        );
      }
      currentName = upstreamName;
      currentItem = upstreamItemIdx;
    }
    return undefined;
  };
}

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
  /**
   * Upstream node outputs keyed by display name. Powers
   * `{{ $node["Webhook"].json.email }}` and `{{ $node.Webhook.json.email }}`
   * references. Each value should already be in the shape
   * `{ json: { ... } }` so member access works the way n8n authors expect.
   */
  nodeOutputs?: Record<string, unknown>;
  /**
   * Display name of the immediately-upstream node — drives the `$prevNode`
   * shortcut so authors can reference the latest predecessor without naming
   * it. When omitted, `$prevNode` resolves to an empty stub.
   */
  prevNodeName?: string;
  /**
   * Execution metadata — `$execution.id`, `$execution.mode`. Defaults to a
   * preview stub when omitted, matching n8n's behaviour during the
   * expression editor's "test" evaluation.
   */
  execution?: { id: string; mode: 'manual' | 'trigger' | 'test' };
  /**
   * Pre-allowlisted env vars exposed as `$env.<KEY>`. Caller (usually
   * `resolveTokens.ts`) picks them off `process.env` once per call — this
   * runner never touches `process.env` directly so the proxy stays safe in
   * sandboxed evaluation paths.
   */
  env?: Record<string, string>;
  /**
   * Current iteration index in the executing block. Exposed as `$itemIndex`
   * and used as the starting point for `$getPairedItem(target)` ancestry
   * walks. Defaults to 0 when omitted.
   */
  currentItemIndex?: number;
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

  // Compute `$prevNode`: name + the immediately-upstream node's output
  // bag. Falls back to an empty stub so templates that reference $prevNode
  // on a root node don't throw — matches n8n's permissive behaviour.
  const nodeOutputs = ctx.nodeOutputs ?? {};
  const prevName = ctx.prevNodeName;
  const prevNodeOutput =
    prevName && Object.prototype.hasOwnProperty.call(nodeOutputs, prevName)
      ? (nodeOutputs[prevName] as {
          json?: unknown;
          binary?: unknown;
          items?: Array<Record<string, unknown>>;
        })
      : { json: {}, binary: {} };

  // Build `$input` — n8n's interface for accessing the immediate upstream
  // items array. Falls back to a single-item stub so simple flows that
  // don't iterate still see consistent semantics.
  const prevItems: Array<Record<string, unknown>> = Array.isArray(
    (prevNodeOutput as { items?: unknown }).items,
  )
    ? ((prevNodeOutput as { items: Array<Record<string, unknown>> }).items)
    : [(prevNodeOutput.json as Record<string, unknown>) ?? {}];
  const inputItem = {
    json: prevItems[0] ?? {},
  };

  return {
    $json: json,
    $vars: ctx.variables ?? {},
    $variables: ctx.variables ?? {},
    $env: ctx.env ?? {},
    $secrets: {},
    $now: DateTime.now().setZone(ctx.timezone ?? 'UTC'),
    $today: DateTime.now().setZone(ctx.timezone ?? 'UTC').startOf('day'),
    $execution: ctx.execution ?? { id: 'sabflow.preview', mode: 'manual' },
    $workflow: ctx.flow
      ? { id: ctx.flow._id?.toString() ?? ctx.flow.name, name: ctx.flow.name, active: ctx.flow.status === 'PUBLISHED' }
      : { id: 'sabflow.preview', name: 'sabflow', active: false },
    // `$prevNode` exposes name + the upstream output bag (`.json`/`.binary`)
    // so authors can write `{{ $prevNode.name }}` and `{{ $prevNode.json.x }}`
    // without having to spell out the upstream node's display name.
    $prevNode: { name: prevName ?? '', ...prevNodeOutput },
    // `$jmesPath` + `$jmespath` (lowercase alias for n8n parity) let
    // authors query nested JSON with a JMESPath expression — e.g.
    // `{{ $jmesPath($json, 'items[?score > `5`].name | [0]') }}`.
    $jmesPath: jmespathWrapper,
    $jmespath: jmespathWrapper,
    // `$getPairedItem(target)` walks the pairedItem chain back to the
    // ancestor node `target` and returns ITS contributing item. Useful when
    // a deep downstream needs a field from the original webhook even after
    // several hops/transformations have lost the direct reference.
    $getPairedItem: makeGetPairedItem(
      nodeOutputs,
      ctx.currentNodeName,
      ctx.currentItemIndex ?? 0,
    ),
    // `$itemIndex` — current iteration position. Also `$runIndex` (always
    // 0 today since sabflow doesn't yet run a node multiple times for
    // retry/branching at the run level).
    $itemIndex: ctx.currentItemIndex ?? 0,
    // Luxon classes available as bare identifiers in expressions —
    // `{{ DateTime.now().toFormat('yyyy') }}` etc. n8n exposes the same
    // trio so ported templates work without rewrites.
    DateTime,
    Duration,
    Interval,
    // `$node` maps upstream display name → its output payload. The legacy
    // engine treats it as a plain object so `$node["Webhook"].json.x` and
    // `$node.Webhook.json.x` both reduce to ordinary property lookups.
    // The synthetic `name` field is kept for back-compat with templates
    // that read `$node.name` directly.
    $node: {
      ...nodeOutputs,
      name: stubNode.name,
    } as IWorkflowDataProxyData['$node'],
    $item: () => stubConnectionData,
    $items: () => items,
    // `$input` — n8n's "items flowing into this node" object. Provides
    //   $input.item    → current item (`{ json: {...} }`)
    //   $input.first() → first item
    //   $input.last()  → last item
    //   $input.all()   → array of all items, each wrapped as `{ json: {...} }`
    $input: {
      item: inputItem,
      first: () => ({ json: prevItems[0] ?? {} }),
      last: () => ({ json: prevItems[prevItems.length - 1] ?? {} }),
      all: () => prevItems.map((it) => ({ json: it })),
    },
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
