/**
 * SabFlow execution-state schema (Track B · Phase 1 · sub-task #4).
 *
 * Mongo-side representation of an in-flight or completed workflow execution.
 * Mirrors n8n's `execution_entity` shape but adapted for SabNode's stack:
 *   - Mongo (native driver) in place of TypeORM + Postgres.
 *   - Per-node state captured inline on the doc (small) with large I/O
 *     payloads pushed to R2 via SabFiles, referenced through pointer fields.
 *   - Multi-tenant `workspaceId` on every doc — non-negotiable.
 *
 * See: docs/adr/sabflow-execution-state.md
 *
 * Sibling sub-task #8 (Track B · Phase 1) owns the `NodeError` taxonomy
 * (n8n-compat `NodeApiError` / `NodeOperationError`). It is forward-declared
 * here as a minimal structural type so this file can land independently;
 * once #8 ships, the canonical type should be re-exported from
 * `@/lib/sabflow/executor/errors`.
 *
 * No `mongoose` dep in this codebase (we use the native `mongodb` driver).
 * `SabFlowExecutionModel` is the model facade — a typed Collection accessor
 * plus index/TTL bootstrap and CRUD helpers — fulfilling the same role as a
 * Mongoose model without pulling in a second ODM. The shape, indexes, and
 * TTL contract match what a `mongoose.Schema` would emit.
 */

import 'server-only';
import { ObjectId, type Collection, type Db } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

/* ──────────────────────────────────────────────────────────────────────────
 * Forward declarations
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Forward-declared NodeError. Canonical taxonomy is owned by Track B · Phase 1
 * sub-task #8 (`errors.ts`). Keep this minimal — adding optional fields here
 * is fine, but the authoritative discriminated union must come from #8.
 *
 * Maps loosely to n8n's `NodeApiError` / `NodeOperationError` + `cause`.
 */
export interface NodeError {
  /** Stable error code (e.g. `NODE_API_ERROR`, `NODE_OP_ERROR`, `TIMEOUT`). */
  code: string;
  /** Human-readable message. Safe to surface to authors. */
  message: string;
  /** Optional node-id where the error originated. */
  nodeId?: string;
  /** Upstream HTTP status if the failure was an API call. */
  httpStatus?: number;
  /** True iff `continueOnFail` semantics should suppress propagation. */
  recoverable?: boolean;
  /** Free-form structured detail; safe to JSON-stringify. */
  detail?: Record<string, unknown>;
  /** Server-side stack — never serialised to clients without a redaction pass. */
  stack?: string;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Status / mode enums (string-literal unions, n8n-compat)
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Lifecycle status of an execution. Matches n8n's `ExecutionStatus`.
 *
 * - `new`      — row created, not yet picked up by a worker
 * - `running`  — worker has claimed it and at least one node is in-flight
 * - `waiting`  — paused on a Wait / Webhook-response / Sub-workflow boundary
 * - `success`  — terminal: all reachable nodes finished cleanly
 * - `error`    — terminal: a node failed and `continueOnFail` did not save it
 * - `canceled` — terminal: stopped via user action or admin tooling
 * - `crashed`  — terminal: the worker died mid-execution (heartbeat lost)
 */
export type ExecutionStatus =
  | 'new'
  | 'running'
  | 'waiting'
  | 'success'
  | 'error'
  | 'canceled'
  | 'crashed';

/**
 * How the execution was triggered. Matches n8n's `WorkflowExecuteMode` enum
 * (with `integrated` / `cli` collapsed into `subworkflow` since SabFlow has
 * no CLI invocation path; sub-workflow covers the "called by another flow"
 * case).
 *
 * - `manual`      — editor "Execute workflow" button or admin re-run
 * - `trigger`     — non-webhook trigger fired (cron, mongo change-stream, ...)
 * - `webhook`     — inbound HTTP delivery via the public webhook URL
 * - `retry`       — re-run of a prior failed execution (see `retryOfExecutionId`)
 * - `subworkflow` — invoked by a parent flow (see `parentExecutionId`)
 */
export type ExecutionMode =
  | 'manual'
  | 'trigger'
  | 'webhook'
  | 'retry'
  | 'subworkflow';

/**
 * Per-node state captured inline on the execution doc.
 *
 * Kept intentionally compact — large per-node I/O payloads are NOT inlined
 * here; they go to R2 via SabFiles and are referenced by
 * `ExecutionDoc.dataPointer` (workflow-level pointer to a structured
 * per-node payload map). `itemsIn` / `itemsOut` are counts only, used for
 * cheap UI rendering of the run timeline without fetching the cold payload.
 */
export interface NodeRunState {
  /** Stable node id (matches the editor doc's node id). */
  nodeId: string;
  /** Per-node lifecycle marker. */
  status: 'pending' | 'running' | 'success' | 'error' | 'skipped';
  /** First time this node entered `running`. */
  startedAt?: Date;
  /** Last time this node left `running` (success, error, or skip). */
  finishedAt?: Date;
  /** Error captured if `status === 'error'`. */
  error?: NodeError;
  /** Count of items consumed from upstream. Cheap UI counter. */
  itemsIn?: number;
  /** Count of items emitted downstream. Cheap UI counter. */
  itemsOut?: number;
  /** Attempt counter — incremented on each retry. Starts at 1 on first run. */
  tries: number;
}

/* ──────────────────────────────────────────────────────────────────────────
 * ExecutionDoc — the canonical Mongo document
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * One row per execution. Stored in collection `sabflow_executions` (see the
 * `SABFLOW_EXECUTIONS_COLLECTION` constant).
 *
 * Large I/O is pushed to R2 via SabFiles (see ADR §3 "Pointer indirection").
 * `dataPointer` / `errorPointer` are SabFiles keys, NOT raw R2 URLs — never
 * expose a free-text URL paste path (per `CLAUDE.md` SabFiles policy).
 */
export interface ExecutionDoc {
  /** Mongo ObjectId. n8n uses an int autoincrement; we use Mongo's native PK. */
  _id: ObjectId;
  /** Tenant scope. MANDATORY on every query. */
  workspaceId: ObjectId;
  /** FK → `sabflows._id` (the workflow definition). */
  workflowId: ObjectId;
  /**
   * Snapshot of the workflow `version` (compaction generation) this execution
   * was launched against. Lets us replay deterministically even after later
   * edits.
   */
  workflowVersion: number;
  /** How the run was started. */
  mode: ExecutionMode;
  /** Current lifecycle status. */
  status: ExecutionStatus;
  /** Server-assigned start time. */
  startedAt: Date;
  /** Set when `status` transitions to a terminal value. */
  finishedAt?: Date;
  /**
   * Inline trigger payload (small webhook bodies, manual-run pin data).
   * Anything > 16 KB should be written to R2 via SabFiles and referenced
   * through `dataPointer` instead.
   */
  triggerData?: Record<string, unknown>;
  /**
   * SabFiles key for the structured per-node I/O payload map. Stored as
   * `__system/sabflow/executions/<workspaceId>/<executionId>/data.json` (or
   * `.bin` for binary). Hydrated on demand by the editor "Run details" view.
   */
  dataPointer?: string;
  /**
   * SabFiles key for the full error envelope (stack, request/response dumps,
   * etc). Separate from `dataPointer` so a successful read of node I/O
   * doesn't force pulling the error blob.
   */
  errorPointer?: string;
  /** Per-node lifecycle map. Keyed by `nodeId` for O(1) update. */
  nodeStates: Record<string, NodeRunState>;
  /** Set when this execution was started as a sub-workflow. */
  parentExecutionId?: ObjectId;
  /** Set when this execution is a retry of a prior failed run. */
  retryOfExecutionId?: ObjectId;
  /**
   * TTL anchor. Set by `createExecution` to `startedAt + retentionDays`
   * derived from the workspace plan tier (see ADR §3). Mongo's TTL monitor
   * evicts the row when this date passes. Plan tier upgrades that extend
   * retention should re-write this field on existing rows.
   */
  expiresAt: Date;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Collection / model facade
 * ──────────────────────────────────────────────────────────────────────── */

export const SABFLOW_EXECUTIONS_COLLECTION = 'sabflow_executions' as const;

/**
 * Default retention window before the TTL monitor evicts a row.
 *
 * 30 days is the generous baseline used by `createExecution` when the caller
 * does not pass an explicit `retentionDays`. Plan-tier-aware callers (see
 * ADR §3) should override this:
 *   free       =   7 days
 *   pro        =  30 days  (matches this constant)
 *   business   =  90 days
 *   enterprise = 365 days
 */
export const DEFAULT_RETENTION_DAYS = 30;

const SECONDS_PER_DAY = 86_400;

/**
 * Indexes bootstrapped on first access. Listed here as a contract — see
 * ADR §3 for rationale. All workspace-scoped indexes are prefixed by
 * `workspaceId` so cross-tenant index scans are structurally impossible.
 */
async function ensureIndexes(col: Collection<ExecutionDoc>): Promise<void> {
  await Promise.all([
    // Workspace dashboard list (recent first).
    col.createIndex({ workspaceId: 1, startedAt: -1 }, { background: true }),
    // "Failures in this window" / status-scoped filters.
    col.createIndex({ status: 1, startedAt: -1 }, { background: true }),
    // Per-workflow execution history.
    col.createIndex({ workflowId: 1, startedAt: -1 }, { background: true }),
    // Sub-workflow lineage traversal (parent → children).
    col.createIndex(
      { parentExecutionId: 1 },
      { background: true, sparse: true },
    ),
    // Retry chains.
    col.createIndex(
      { retryOfExecutionId: 1 },
      { background: true, sparse: true },
    ),
    // TTL — Mongo evicts when `expiresAt < now()`. `expireAfterSeconds: 0`
    // means "use the field's value as the absolute eviction time".
    col.createIndex(
      { expiresAt: 1 },
      { expireAfterSeconds: 0, background: true },
    ),
  ]);
}

let collectionPromise: Promise<Collection<ExecutionDoc>> | null = null;

/**
 * Returns the typed `sabflow_executions` collection, bootstrapping indexes on
 * first call. Subsequent calls reuse the cached promise.
 */
export async function getExecutionCollection(): Promise<Collection<ExecutionDoc>> {
  if (collectionPromise) return collectionPromise;
  collectionPromise = (async () => {
    const { db } = await connectToDatabase();
    const col = (db as Db).collection<ExecutionDoc>(SABFLOW_EXECUTIONS_COLLECTION);
    await ensureIndexes(col);
    return col;
  })();
  return collectionPromise;
}

/**
 * Model facade — a thin, typed object that exposes the canonical
 * `Collection<ExecutionDoc>` plus the bootstrap and helper surface.
 *
 * This mirrors what a `mongoose.model('SabFlowExecution', schema)` would
 * export, without dragging Mongoose into a project that uses the native
 * driver everywhere else.
 */
export const SabFlowExecutionModel = {
  collectionName: SABFLOW_EXECUTIONS_COLLECTION,
  defaultRetentionDays: DEFAULT_RETENTION_DAYS,
  collection: getExecutionCollection,
  ensureIndexes: async () => ensureIndexes(await getExecutionCollection()),
} as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────── */

export interface CreateExecutionArgs {
  workspaceId: ObjectId | string;
  workflowId: ObjectId | string;
  workflowVersion: number;
  mode: ExecutionMode;
  triggerData?: Record<string, unknown>;
  parentExecutionId?: ObjectId | string;
  retryOfExecutionId?: ObjectId | string;
  /**
   * Override the TTL window for this execution. Plan-tier resolution lives
   * in the caller (see ADR §3 retention table). Defaults to
   * `DEFAULT_RETENTION_DAYS` (30) when omitted.
   */
  retentionDays?: number;
  /** Allow callers to inject a fixed clock for tests / replay. */
  now?: () => Date;
}

function toObjectId(value: ObjectId | string): ObjectId {
  return typeof value === 'string' ? new ObjectId(value) : value;
}

function toOptionalObjectId(
  value: ObjectId | string | undefined,
): ObjectId | undefined {
  return value === undefined ? undefined : toObjectId(value);
}

/**
 * Creates a new execution row in `new` status.
 *
 * - Sets `startedAt` to `now()`.
 * - Sets `expiresAt` to `startedAt + retentionDays`.
 * - Initialises `nodeStates` to an empty map — the executor (sub-task #2
 *   contract) populates per-node entries as nodes are scheduled.
 *
 * Note on status: n8n's `execution_entity` starts at `new` then flips to
 * `running` when the worker claims the job (mirrors Bull's "active" state).
 * SabFlow keeps that two-step so observers can distinguish "queued" from
 * "in-flight" for queue-depth metrics.
 */
export async function createExecution(
  args: CreateExecutionArgs,
): Promise<ExecutionDoc> {
  const col = await getExecutionCollection();
  const now = (args.now ?? (() => new Date()))();
  const retentionDays = args.retentionDays ?? DEFAULT_RETENTION_DAYS;
  const expiresAt = new Date(now.getTime() + retentionDays * SECONDS_PER_DAY * 1000);

  const doc: ExecutionDoc = {
    _id: new ObjectId(),
    workspaceId: toObjectId(args.workspaceId),
    workflowId: toObjectId(args.workflowId),
    workflowVersion: args.workflowVersion,
    mode: args.mode,
    status: 'new',
    startedAt: now,
    triggerData: args.triggerData,
    nodeStates: {},
    parentExecutionId: toOptionalObjectId(args.parentExecutionId),
    retryOfExecutionId: toOptionalObjectId(args.retryOfExecutionId),
    expiresAt,
  };

  await col.insertOne(doc);
  return doc;
}
