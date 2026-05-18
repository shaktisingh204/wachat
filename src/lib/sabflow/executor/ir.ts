/**
 * SabFlow workflow IR (intermediate representation).
 *
 * Track B — Phase 1 — Sub-task #3.
 *
 * This file defines the **internal IR** the Track B executor consumes. It is
 * deliberately n8n-compatible (source-indexed connection model, namespaced
 * node `type` + `typeVersion`, per-node retry/error fields) so that
 * `interop/n8nImport.ts` and `interop/n8nExport.ts` can round-trip through
 * the IR with the lossless guarantees described in
 * `docs/adr/sabflow-doc-schema.md` (see §3, §4, §5).
 *
 * The authoring shape (`SabFlowDoc` — groups + edges + events) is **not** the
 * IR. The adapter `irFromSabFlowDoc` (stub below — implemented in Phase B.2)
 * flattens the authoring shape into this IR following the mapping table in
 * `docs/adr/sabflow-doc-schema.md` §3.
 *
 * Constraints (per sub-task brief):
 *   - No external dependencies. Pure TypeScript.
 *   - No imports from sibling SabFlow files (this module is leaf-level — it
 *     must be safe to consume from both the Node executor and any future
 *     Rust IPC bridge that re-emits the same JSON shape).
 */

// ---------------------------------------------------------------------------
// Core IR types
// ---------------------------------------------------------------------------

/**
 * A single node in the executable graph.
 *
 * Mirrors n8n's `INode` subset that the executor actually reads at run-time:
 * the editor-only fields (`position`, `name`, `webhookId`) are intentionally
 * absent because they have no bearing on execution semantics. They live on
 * `SabFlowDoc` and are reattached on export.
 */
export interface IRNode {
  /** Stable id. Unique within the graph; used as the key in IREdge endpoints. */
  id: string;
  /** Namespaced node type, e.g. `n8n-nodes-base.httpRequest` or `SabFlow.Loop`. */
  type: string;
  /**
   * Per-type schema version. Required — every node MUST declare a version so
   * the executor can dispatch the right implementation and so migrators
   * (`src/lib/sabflow/migrations/nodes/<type>/vN-to-vM.ts`) can run on load.
   */
  typeVersion: number;
  /** Per-type configuration object. Free-form by design. */
  parameters: Record<string, unknown>;
  /** Optional credential references, keyed by credential name. */
  credentials?: Record<string, { id: string; name: string }>;
  /** If true, the node is skipped during execution. */
  disabled?: boolean;
  /**
   * Legacy n8n compat flag — if true, a failure does not halt the workflow;
   * the error is forwarded on the regular output. Prefer `onError` on the
   * node's parameters object for new code.
   */
  continueOnFail?: boolean;
  /** If true, the executor retries this node on failure up to `maxTries`. */
  retryOnFail?: boolean;
  /** Maximum number of attempts when `retryOnFail` is true. */
  maxTries?: number;
  /** Free-text annotation, surfaced in the inspector / execution log. */
  notes?: string;
}

/**
 * A directed edge between two node handles.
 *
 * **Source-indexed form** — `from.outputIndex` is the handle on the source
 * node, `to.inputIndex` is the handle on the target node. This matches
 * n8n's `connections[src][type][outIdx][N] = { node, type, index }` shape
 * (see `docs/adr/sabflow-doc-schema.md` §1.3) once it is flattened into a
 * list of edges.
 *
 * Output / input *type* (e.g. `main`, `ai_tool`) is collapsed into the
 * `outputIndex` / `inputIndex` numbering by the adapter; multi-typed handles
 * are encoded as sequential indices.
 */
export interface IREdge {
  from: { nodeId: string; outputIndex: number };
  to: { nodeId: string; inputIndex: number };
}

/**
 * A trigger entry-point into the workflow.
 *
 * SabFlow's authoring doc holds these in a top-level `events` array
 * (`SabFlowDoc.events`). The IR keeps them as a sibling list to `nodes`
 * because they are the only legal starting points for a topo walk.
 */
export interface IRTrigger {
  /** Must match an `IRNode.id` whose `type` is a trigger node. */
  nodeId: string;
  kind: 'manual' | 'webhook' | 'cron' | 'event';
}

/**
 * Top-level executable representation of a workflow.
 *
 * The executor consumes this shape verbatim. Persistence + CRDT collab use
 * `SabFlowDoc` (see `src/lib/sabflow/types.ts:1407`); the adapter below
 * converts between them.
 */
export interface WorkflowGraph {
  /** Workflow id — stable across executions. */
  id: string;
  /**
   * Optimistic-locking counter. Matches `SabFlowDoc.version`
   * (`src/lib/sabflow/types.ts:1439`).
   */
  version: number;
  nodes: IRNode[];
  edges: IREdge[];
  triggers: IRTrigger[];
  settings: {
    /** Per-execution timeout in seconds. */
    timeoutSec?: number;
    /**
     * Execution-data retention policy. Mirrors n8n's `IWorkflowSettings`
     * `saveExecutionProgress` / `saveManualExecutions` flags collapsed to a
     * single tri-state.
     */
    saveData?: 'none' | 'on-error' | 'all';
    /** Workflow id to run when this workflow errors. n8n parity. */
    errorWorkflowId?: string;
  };
}

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

export type ValidationErrorCode =
  | 'EDGE_FROM_UNKNOWN_NODE'
  | 'EDGE_TO_UNKNOWN_NODE'
  | 'NO_TRIGGER'
  | 'TRIGGER_UNKNOWN_NODE'
  | 'CYCLE'
  | 'MISSING_TYPE_VERSION';

export interface ValidationError {
  code: ValidationErrorCode;
  message: string;
  /** Ids of the nodes / edges involved, for surfacing in the editor. */
  refs?: string[];
}

export interface ValidationResult {
  ok: boolean;
  errors: ValidationError[];
}

/**
 * Default list of node `type` values that are *allowed* to participate in a
 * cycle (loop-back edges). Anything else creating a cycle is a hard error.
 *
 * Track B Phase 3 sub-task #6 owns the runtime semantics of these nodes.
 */
export const DEFAULT_LOOP_NODE_TYPES: ReadonlyArray<string> = [
  'SabFlow.Loop',
  'SabFlow.LoopOverItems',
];

/**
 * Validate the executable invariants of a workflow IR.
 *
 * Checks (in order):
 *   1. Every edge endpoint references an existing node.
 *   2. At least one trigger exists, and each trigger points at a real node.
 *   3. Every node has `typeVersion` set (required for migrations + dispatch).
 *   4. The DAG (ignoring loop-back edges through allowed loop node types) is
 *      acyclic.
 *
 * Returns *all* errors found, not just the first — the editor surfaces them
 * in one pass.
 */
export function validateWorkflowGraph(
  g: WorkflowGraph,
  opts?: { allowedLoopNodeTypes?: ReadonlyArray<string> },
): ValidationResult {
  const errors: ValidationError[] = [];
  const allowedLoopTypes = new Set<string>(
    opts?.allowedLoopNodeTypes ?? DEFAULT_LOOP_NODE_TYPES,
  );

  const nodeById = new Map<string, IRNode>();
  for (const n of g.nodes) nodeById.set(n.id, n);

  // 1. Edge endpoints must reference existing nodes.
  for (const e of g.edges) {
    if (!nodeById.has(e.from.nodeId)) {
      errors.push({
        code: 'EDGE_FROM_UNKNOWN_NODE',
        message: `Edge references unknown source node "${e.from.nodeId}".`,
        refs: [e.from.nodeId],
      });
    }
    if (!nodeById.has(e.to.nodeId)) {
      errors.push({
        code: 'EDGE_TO_UNKNOWN_NODE',
        message: `Edge references unknown target node "${e.to.nodeId}".`,
        refs: [e.to.nodeId],
      });
    }
  }

  // 2. Trigger checks.
  if (g.triggers.length === 0) {
    errors.push({
      code: 'NO_TRIGGER',
      message: 'Workflow has no triggers — at least one is required.',
    });
  }
  for (const t of g.triggers) {
    if (!nodeById.has(t.nodeId)) {
      errors.push({
        code: 'TRIGGER_UNKNOWN_NODE',
        message: `Trigger references unknown node "${t.nodeId}".`,
        refs: [t.nodeId],
      });
    }
  }

  // 3. typeVersion present on every node.
  for (const n of g.nodes) {
    if (typeof n.typeVersion !== 'number' || !Number.isFinite(n.typeVersion)) {
      errors.push({
        code: 'MISSING_TYPE_VERSION',
        message: `Node "${n.id}" (type "${n.type}") is missing typeVersion.`,
        refs: [n.id],
      });
    }
  }

  // 4. Cycle detection on the edge set *excluding* edges that terminate at
  //    an allowed-loop node — those are the legal loop-back arcs. Edges from
  //    a loop node back upstream are dropped from the DAG view.
  const cycle = findCycle(g, nodeById, allowedLoopTypes);
  if (cycle) {
    errors.push({
      code: 'CYCLE',
      message: `Cycle detected through nodes: ${cycle.join(' -> ')}.`,
      refs: cycle,
    });
  }

  return { ok: errors.length === 0, errors };
}

/**
 * Build the per-node outbound adjacency map used for both cycle detection
 * and topo sort. Edges that loop *back into* an allowed loop node are
 * dropped so the DAG view stays acyclic.
 *
 * "Loop-back" definition: an edge whose *target* is a node whose `type` is
 * in `allowedLoopTypes` AND whose `inputIndex >= 1`. The convention follows
 * n8n's Loop/LoopOverItems nodes where input 0 is the upstream feed and
 * input 1+ is the "done" / "loop" re-entry handle. The adapter MUST emit
 * loop arcs on input index >= 1; a violation surfaces as a CYCLE error.
 */
function buildDagAdjacency(
  g: WorkflowGraph,
  nodeById: Map<string, IRNode>,
  allowedLoopTypes: Set<string>,
): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const n of g.nodes) adj.set(n.id, []);

  for (const e of g.edges) {
    if (!nodeById.has(e.from.nodeId) || !nodeById.has(e.to.nodeId)) continue;
    const target = nodeById.get(e.to.nodeId)!;
    const isLoopBack =
      allowedLoopTypes.has(target.type) && e.to.inputIndex >= 1;
    if (isLoopBack) continue;
    adj.get(e.from.nodeId)!.push(e.to.nodeId);
  }
  return adj;
}

/**
 * DFS-based cycle finder. Returns the offending node id sequence (the cycle
 * itself, ending with the repeated node) or null when the graph is acyclic.
 */
function findCycle(
  g: WorkflowGraph,
  nodeById: Map<string, IRNode>,
  allowedLoopTypes: Set<string>,
): string[] | null {
  const adj = buildDagAdjacency(g, nodeById, allowedLoopTypes);
  const WHITE = 0;
  const GRAY = 1;
  const BLACK = 2;
  const color = new Map<string, number>();
  for (const n of g.nodes) color.set(n.id, WHITE);
  const stack: string[] = [];

  function visit(id: string): string[] | null {
    color.set(id, GRAY);
    stack.push(id);
    for (const nxt of adj.get(id) ?? []) {
      const c = color.get(nxt) ?? WHITE;
      if (c === GRAY) {
        // Cycle: slice from where `nxt` first appears in the stack.
        const startIdx = stack.indexOf(nxt);
        return stack.slice(startIdx).concat(nxt);
      }
      if (c === WHITE) {
        const found = visit(nxt);
        if (found) return found;
      }
    }
    stack.pop();
    color.set(id, BLACK);
    return null;
  }

  for (const n of g.nodes) {
    if ((color.get(n.id) ?? WHITE) === WHITE) {
      const found = visit(n.id);
      if (found) return found;
    }
  }
  return null;
}

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

/**
 * Topologically sort the workflow's nodes, ignoring loop-back edges
 * (defined the same way as in cycle detection).
 *
 * Uses Kahn's algorithm so the output is deterministic for any given input
 * order (nodes are visited in their original `g.nodes` order whenever the
 * in-degree allows it — important for stable execution traces).
 *
 * Throws if the DAG view still contains a cycle. Callers should run
 * `validateWorkflowGraph` first and bail on errors.
 */
export function topoSort(
  g: WorkflowGraph,
  opts?: { allowedLoopNodeTypes?: ReadonlyArray<string> },
): IRNode[] {
  const allowedLoopTypes = new Set<string>(
    opts?.allowedLoopNodeTypes ?? DEFAULT_LOOP_NODE_TYPES,
  );
  const nodeById = new Map<string, IRNode>();
  for (const n of g.nodes) nodeById.set(n.id, n);

  const adj = buildDagAdjacency(g, nodeById, allowedLoopTypes);
  const inDegree = new Map<string, number>();
  for (const n of g.nodes) inDegree.set(n.id, 0);
  for (const [, outs] of adj) {
    for (const dst of outs) {
      inDegree.set(dst, (inDegree.get(dst) ?? 0) + 1);
    }
  }

  // Seed the queue in the original node order so the sort is stable.
  const queue: string[] = [];
  for (const n of g.nodes) {
    if ((inDegree.get(n.id) ?? 0) === 0) queue.push(n.id);
  }

  const out: IRNode[] = [];
  while (queue.length > 0) {
    const id = queue.shift()!;
    const node = nodeById.get(id);
    if (node) out.push(node);
    for (const dst of adj.get(id) ?? []) {
      const next = (inDegree.get(dst) ?? 0) - 1;
      inDegree.set(dst, next);
      if (next === 0) queue.push(dst);
    }
  }

  if (out.length !== g.nodes.length) {
    throw new Error(
      'topoSort: cycle detected in DAG view — call validateWorkflowGraph first.',
    );
  }
  return out;
}

// ---------------------------------------------------------------------------
// Adapter — SabFlowDoc -> IR
// ---------------------------------------------------------------------------

/**
 * Build the IR from a `SabFlowDoc`.
 *
 * Implemented in Phase B.2 (see `PLAN-sabflow-crdt-collab.md` — Track B
 * Phase 2). The mapping follows `docs/adr/sabflow-doc-schema.md` §3:
 *
 *   - `SabFlowDoc.events[]`         -> `IRNode` (trigger) + `IRTrigger`
 *   - `SabFlowDoc.groups[].blocks`  -> `IRNode`
 *   - `SabFlowDoc.edges[]`          -> `IREdge` (source-indexed, with
 *                                     `outputIndex` / `inputIndex` parsed
 *                                     from the `outputs/main/N` handle
 *                                     convention)
 *   - `SabFlowDoc.settings`         -> `WorkflowGraph.settings` (subset:
 *                                     `timeoutSec`, `saveData`,
 *                                     `errorWorkflowId`).
 *
 * The signature is intentionally `unknown` for the input so this leaf
 * module stays free of imports from sibling SabFlow files (per sub-task
 * constraints). Phase B.2 will tighten the type at the call site.
 */
export function irFromSabFlowDoc(_doc: unknown): WorkflowGraph {
  throw new Error('irFromSabFlowDoc: implemented in Phase B.2');
}
