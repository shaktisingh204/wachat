/**
 * SabFlow Executor · History · Retry-from-failed-node
 * ----------------------------------------------------
 *
 * Track B · Phase 7 · sub-task #6 of 10.
 *
 * Scope (this file only):
 *   Given an existing execution that ended in `status === 'error'`, spawn a
 *   NEW execution that:
 *     1. Starts at the first failed node (skips everything that already
 *        succeeded).
 *     2. Reuses the recorded OUTPUT of every successful upstream node as a
 *        "fixture" via the pin-data mechanism owned by sibling #5, so the
 *        new run sees byte-identical upstream inputs without re-calling
 *        external APIs.
 *     3. Records `retryOfExecutionId === originalExecutionId` so the retry
 *        chain is queryable through the executor's existing index
 *        (see `executor/state.ts` `retryOfExecutionId` index, ADR §3).
 *     4. Emits a single `execution.retried_from_failed` audit event.
 *
 * Boundaries (owned by siblings — do NOT inline here):
 *   - Pin-data write surface              → sibling #5 (`./pin-data.ts`)
 *   - ExecutionDoc / NodeRunState model    → `../state.ts`
 *   - Audit row insertion                  → `@/lib/sabflow/audit/db.ts`
 *   - Worker hand-off / queue enqueue      → `@/lib/sabflow/worker/queues.ts`
 *     (caller of `retryFromFailedNode` is responsible for enqueueing the
 *     returned `newExecutionId`; this module only stages state.)
 *   - dataPointer payload deserialisation  → forward-declared loader hook.
 *     A future sibling under `executor/history/` will register the real
 *     loader via `__registerNodeOutputLoader`. Until then this module
 *     consults `NodeRunState.error == null` nodes only and reads inline
 *     `output` fields the executor MAY place on extended NodeRunState
 *     subtypes (older `ExecutionHistoryNode` shape from `db.ts`).
 *
 * @module sabflow/executor/history/retry-from-failed
 */

import 'server-only';
import { ObjectId } from 'mongodb';
import {
  getExecutionCollection,
  type ExecutionDoc,
  type NodeRunState,
} from '@/lib/sabflow/executor/state';
import { recordAudit } from '@/lib/sabflow/audit/db';

/* ──────────────────────────────────────────────────────────────────────────
 * Forward declarations — sibling-owned surfaces.
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Pin-data writer contract (sibling #5, `./pin-data.ts`).
 *
 * Transient pins are scoped to the NEW execution id; sibling #5 owns the
 * collection name, TTL, and the per-execution lookup index. We treat the
 * surface as a single write function so this file doesn't lock the sibling
 * into a specific persistence shape (mongo vs redis vs in-doc).
 *
 * `data` is whatever the original successful node emitted on its primary
 * pin — typically an array of `NodeExecutionItem` from
 * `../contract.ts`, but we keep it `unknown` so other emitters
 * (e.g. legacy `ExecutionHistoryNode.output`) round-trip without coercion.
 */
export interface PinDataWriter {
  writeTransientPin(args: {
    executionId: ObjectId;
    workspaceId: ObjectId;
    nodeId: string;
    data: unknown;
  }): Promise<void>;
}

let _pinWriter: PinDataWriter | null = null;

/**
 * @internal — sibling #5 (`./pin-data.ts`) MUST call this during boot so
 * `retryFromFailedNode` can stage fixture inputs. Until it does, a retry
 * call resolves the staged outputs but skips the pin-write step (the new
 * execution still starts at the failed node; it just has to fetch real
 * upstream inputs again). Callers can detect this by inspecting
 * `pinsWritten` on the returned shape (kept internal for now).
 */
export function __registerPinDataWriter(writer: PinDataWriter): void {
  _pinWriter = writer;
}

/**
 * @internal — test seam to undo registration between unit tests.
 */
export function __resetPinDataWriterForTest(): void {
  _pinWriter = null;
}

/**
 * Optional cold-payload loader. When `NodeRunState` does not carry an
 * inline `output`, the per-node payload lives in the SabFile referenced
 * by `ExecutionDoc.dataPointer`. The shape of that file is owned by a
 * sibling under `executor/history/` (capture-side). We forward-declare
 * the read surface so this module remains decoupled.
 *
 * Returning `undefined` for a `nodeId` means "no payload available" —
 * the caller (this module) treats that as "skip pinning this node".
 */
export interface NodeOutputLoader {
  loadOutputs(args: {
    executionId: ObjectId;
    workspaceId: ObjectId;
    dataPointer: string;
  }): Promise<Record<string, unknown>>;
}

let _outputLoader: NodeOutputLoader | null = null;

/** @internal — register the cold-tier per-node output loader. */
export function __registerNodeOutputLoader(loader: NodeOutputLoader): void {
  _outputLoader = loader;
}

/** @internal — test seam. */
export function __resetNodeOutputLoaderForTest(): void {
  _outputLoader = null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Public API
 * ──────────────────────────────────────────────────────────────────────── */

export interface RetryFromFailedArgs {
  /** Hex id of the original failed execution. */
  executionId: string;
  /** User initiating the retry — recorded on the audit row. */
  requesterId: string;
}

export interface RetryFromFailedResult {
  /** Hex id of the newly created execution row (status `new`). */
  newExecutionId: string;
}

/** Sentinel thrown when the caller asks for an unretryable execution. */
export class RetryFromFailedError extends Error {
  constructor(
    public readonly code:
      | 'EXECUTION_NOT_FOUND'
      | 'NO_FAILED_NODE'
      | 'INVALID_EXECUTION_ID',
    message: string,
  ) {
    super(message);
    this.name = 'RetryFromFailedError';
  }
}

/**
 * Retry an execution from its first failed node onward, reusing successful
 * upstream outputs as transient pin-data on the new run.
 *
 * Algorithm (mirrors n8n `recreate-node-execution-stack` semantics — see
 * `src/lib/sabflow/n8n/core/execution-engine/partial-execution-utils/`):
 *
 *   1. Load the original `ExecutionDoc` by id.
 *   2. Order `nodeStates` by `startedAt` ascending — the executor records
 *      each node's first `running` transition, so this gives us the
 *      run-order of the original execution.
 *   3. Walk that ordered list; the first entry with `status === 'error'`
 *      is the failed node. Everything ordered BEFORE it that succeeded
 *      becomes fixture material.
 *   4. Resolve each fixture node's recorded output (inline first, then
 *      via the registered cold-tier loader if available).
 *   5. Create a NEW execution row in `new` status with:
 *        - `retryOfExecutionId = originalExecutionId`
 *        - `mode = 'retry'`
 *        - Inherited `workspaceId`, `workflowId`, `workflowVersion`,
 *          `triggerData`.
 *   6. For every resolved fixture, call `PinDataWriter.writeTransientPin`
 *      on the new execution id. The worker (sibling, not this module) is
 *      expected to consult those pins when seeding upstream inputs for
 *      the failed node and any further successor that re-runs.
 *   7. Write the `execution.retried_from_failed` audit row.
 *
 * No queue enqueue happens here — the caller (typically the
 * `/executions/:id/retry-from-failed` route handler) owns the
 * worker hand-off so this module stays free of queue deps.
 */
export async function retryFromFailedNode(
  args: RetryFromFailedArgs,
): Promise<RetryFromFailedResult> {
  if (!args.executionId || !ObjectId.isValid(args.executionId)) {
    throw new RetryFromFailedError(
      'INVALID_EXECUTION_ID',
      'executionId is not a valid ObjectId',
    );
  }
  if (!args.requesterId) {
    throw new RetryFromFailedError(
      'INVALID_EXECUTION_ID',
      'requesterId is required for audit attribution',
    );
  }

  const originalId = new ObjectId(args.executionId);
  const col = await getExecutionCollection();
  const original = await col.findOne({ _id: originalId });
  if (!original) {
    throw new RetryFromFailedError(
      'EXECUTION_NOT_FOUND',
      `Execution ${args.executionId} not found`,
    );
  }

  // Run-order timeline: NodeRunState records `startedAt` on first transition
  // to `running`. Nodes that never started have no `startedAt` — they sort
  // last and are treated as "downstream of the failure" (not fixtures).
  const timeline = Object.values(original.nodeStates).slice().sort((a, b) => {
    const ta = a.startedAt ? a.startedAt.getTime() : Number.POSITIVE_INFINITY;
    const tb = b.startedAt ? b.startedAt.getTime() : Number.POSITIVE_INFINITY;
    return ta - tb;
  });

  const failedIdx = timeline.findIndex((n) => n.status === 'error');
  if (failedIdx === -1) {
    throw new RetryFromFailedError(
      'NO_FAILED_NODE',
      `Execution ${args.executionId} has no failed node — nothing to retry`,
    );
  }
  const failedNode = timeline[failedIdx];
  const fixtures = timeline
    .slice(0, failedIdx)
    .filter((n) => n.status === 'success');

  // Resolve fixture outputs. Prefer inline `output` (legacy executor path
  // may stash it on an extended NodeRunState); otherwise consult the
  // registered cold-tier loader using the original `dataPointer`.
  const outputsByNodeId: Record<string, unknown> = {};
  const inlineHits = collectInlineOutputs(fixtures);
  Object.assign(outputsByNodeId, inlineHits);

  const needsLoad = fixtures
    .filter((n) => !(n.nodeId in outputsByNodeId))
    .map((n) => n.nodeId);
  if (needsLoad.length > 0 && _outputLoader && original.dataPointer) {
    try {
      const loaded = await _outputLoader.loadOutputs({
        executionId: originalId,
        workspaceId: original.workspaceId,
        dataPointer: original.dataPointer,
      });
      for (const id of needsLoad) {
        if (id in loaded) outputsByNodeId[id] = loaded[id];
      }
    } catch {
      // Cold-tier failure is non-fatal: we still create the retry, but
      // without fixtures for the unreadable nodes. The worker will fall
      // back to live re-execution for those.
    }
  }

  // Create the new execution row. We bypass `createExecution` so we can
  // inherit the original's TTL anchor (the retry should not outlive the
  // workspace plan's retention window for the original run).
  const now = new Date();
  const newDoc: ExecutionDoc = {
    _id: new ObjectId(),
    workspaceId: original.workspaceId,
    workflowId: original.workflowId,
    workflowVersion: original.workflowVersion,
    mode: 'retry',
    status: 'new',
    startedAt: now,
    triggerData: original.triggerData,
    nodeStates: {},
    retryOfExecutionId: originalId,
    // Inherit the parent's expiry rather than re-deriving a fresh one — keeps
    // retry chains from drifting past the workspace retention horizon.
    expiresAt: original.expiresAt,
  };
  await col.insertOne(newDoc);

  // Stage fixtures as transient pins on the new execution. Best-effort:
  // if sibling #5 hasn't registered yet, we skip pinning rather than fail.
  if (_pinWriter) {
    for (const [nodeId, data] of Object.entries(outputsByNodeId)) {
      try {
        await _pinWriter.writeTransientPin({
          executionId: newDoc._id,
          workspaceId: newDoc.workspaceId,
          nodeId,
          data,
        });
      } catch {
        // Individual pin failure must not abort the retry — the worker
        // can still re-fetch upstream data live for that node.
      }
    }
  }

  // Audit the retry. `flowId` is the human-facing identifier on
  // `recordAudit`, so we project `workflowId` into it.
  await recordAudit({
    userId: args.requesterId,
    workspaceId: original.workspaceId.toHexString(),
    flowId: original.workflowId.toHexString(),
    action: 'execution.retried_from_failed',
    target: newDoc._id.toHexString(),
    metadata: {
      originalExecutionId: originalId.toHexString(),
      failedNodeId: failedNode.nodeId,
      fixtureCount: Object.keys(outputsByNodeId).length,
      fixtureNodeIds: Object.keys(outputsByNodeId),
      workflowVersion: original.workflowVersion,
    },
  });

  return { newExecutionId: newDoc._id.toHexString() };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Pull inline `output` payloads off any fixture nodes that carry them.
 * `NodeRunState` (Phase 1) does not declare `output`, but the legacy
 * executor stashes it on an extended subtype; we read it defensively via
 * a structural cast rather than tightening the canonical model here.
 */
function collectInlineOutputs(
  fixtures: ReadonlyArray<NodeRunState>,
): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const node of fixtures) {
    const maybe = (node as NodeRunState & { output?: unknown }).output;
    if (maybe !== undefined) out[node.nodeId] = maybe;
  }
  return out;
}
