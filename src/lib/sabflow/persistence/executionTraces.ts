/**
 * SabFlow execution traces — persisted per-execution event log.
 *
 * Phase C.9 · sub-task #2.
 *
 * Companion to the in-process `execution/traceBus.ts` pub/sub: that bus only
 * survives the lifetime of the running Node process and is consumed live by
 * the SSE stream endpoint. Once the run terminates, the events are gone.
 *
 * This module persists those events to Mongo so that:
 *   - Closed-page replays can re-show the run timeline.
 *   - Admin tooling / RBAC audits can walk what happened.
 *   - "Pinned" runs (manual debug pins) survive past the default retention.
 *
 * Collection: `sabflow_execution_traces`.
 *
 * Retention:
 *   - Non-pinned runs: TTL evicts 30 days after `expiresAt` (the field is
 *     anchored to `startedAt + 30d` when the trace doc is first written).
 *   - Pinned runs: `pinned = true` AND `expiresAt = null` — TTL skips null
 *     dates per Mongo's standard TTL contract, so these are kept until a
 *     user explicitly unpins or deletes them.
 *
 * Constraints (per Phase C.9 brief):
 *   - Native `mongodb` driver only. No Mongoose, no new deps.
 *   - One row per `executionId` — events are appended to the `events` array
 *     via `$push`. Avoids the per-event document overhead and keeps the
 *     "fetch the whole trace for replay" path to a single `findOne`.
 *
 * Notes on shape:
 *   - `events[].kind` is the trace event discriminator (e.g. `step`,
 *     `node_start`, `node_end`, `inline_payload`, `payload_offloaded`, `end`).
 *     Kept as a free-string here — the engine sibling owns the canonical
 *     taxonomy via `execution/traceBus.ts::TraceEvent`. We don't import that
 *     type to avoid a hard build-time coupling between persistence and the
 *     in-memory bus; the writer is responsible for tagging correctly.
 *   - `sizeBytes` / `inline` / `sabFileId` capture the off-load decision for
 *     payloads: when an item is small it's kept inline on the trace event,
 *     when it's big it lands in SabFiles (`sabFileId` references the file).
 *     Per `CLAUDE.md` SabFiles policy: never expose a free-text URL — always
 *     reference by SabFiles id.
 */

import 'server-only';
import {
  ObjectId,
  type Collection,
  type Db,
  type CreateIndexesOptions,
  type IndexSpecification,
} from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';

/* ──────────────────────────────────────────────────────────────────────────
 * Collection name + retention
 * ──────────────────────────────────────────────────────────────────────── */

export const SABFLOW_EXECUTION_TRACES_COLLECTION =
  'sabflow_execution_traces' as const;

/** 30-day TTL horizon for non-pinned trace docs. */
export const TRACE_DEFAULT_RETENTION_DAYS = 30;

const SECONDS_PER_DAY = 86_400;
const MS_PER_DAY = SECONDS_PER_DAY * 1000;

/* ──────────────────────────────────────────────────────────────────────────
 * Event + doc shape
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * A single persisted trace event.
 *
 * `kind` is free-form (owned by the engine sibling). Common kinds today:
 *   - `node_start`, `node_end` — lifecycle markers per node.
 *   - `inline_payload`        — small per-port payload stored inline.
 *   - `payload_offloaded`     — large per-port payload written to SabFiles.
 *   - `error`                 — node error envelope (paired with `node_end`).
 *   - `end`                   — terminal event for the run.
 *
 * `side` distinguishes input vs output payloads on node-scoped events
 * (`'in' | 'out'`). `itemIndex` is the row index within the upstream / output
 * array; both are optional because lifecycle events without per-item context
 * (like `node_start` or `end`) won't carry them.
 */
export interface TraceEvent {
  kind: string;
  nodeId: string;
  itemIndex?: number;
  side?: 'in' | 'out';
  /** Byte size of the payload this event references (inline or off-loaded). */
  sizeBytes?: number;
  /** True if the payload is captured inline on this event; false → off-loaded. */
  inline?: boolean;
  /** SabFiles id if the payload was off-loaded (see header SabFiles note). */
  sabFileId?: string;
  /** Server-assigned event timestamp. */
  at: Date;
}

/**
 * Persisted trace document — one row per execution.
 *
 * `events` is append-only. `pinned` flips a row out of TTL by clearing
 * `expiresAt`; flipping back unpinned re-anchors the TTL.
 */
export interface ExecutionTraceDoc {
  _id: ObjectId;
  executionId: ObjectId;
  workspaceId: ObjectId;
  events: TraceEvent[];
  pinned: boolean;
  /** Null when `pinned === true` (so the TTL monitor skips this row). */
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Index spec — kept exported so the init script can ensure them idempotently
 * ──────────────────────────────────────────────────────────────────────── */

export interface ExecutionTraceIndexSpec {
  keys: IndexSpecification;
  options: CreateIndexesOptions;
  purpose: string;
}

export const SABFLOW_EXECUTION_TRACES_INDEX_SPECS: readonly ExecutionTraceIndexSpec[] =
  [
    {
      keys: { executionId: 1 },
      options: {
        name: 'executionId_1_unique',
        unique: true,
        background: true,
      },
      purpose:
        'Primary lookup by execution. Unique so concurrent appendTraceEvent ' +
        'calls on the same execution upsert the same row.',
    },
    {
      keys: { workspaceId: 1, pinned: 1, expiresAt: 1 },
      options: {
        name: 'workspaceId_1_pinned_1_expiresAt_1',
        background: true,
      },
      purpose:
        'Workspace-scoped scans split by pin state + retention window — used ' +
        'by admin tooling and the "expiring soon" UI affordance.',
    },
    {
      keys: { expiresAt: 1 },
      options: {
        name: 'expiresAt_1_ttl',
        // `expireAfterSeconds: 0` → use the field's value as the absolute
        // eviction time. Rows with `expiresAt: null` (i.e. pinned) are
        // skipped by the TTL monitor per Mongo semantics.
        expireAfterSeconds: 0,
        background: true,
      },
      purpose:
        'TTL: non-pinned trace docs evicted at expiresAt (30d after createdAt).',
    },
  ] as const;

/* ──────────────────────────────────────────────────────────────────────────
 * Collection bootstrap
 * ──────────────────────────────────────────────────────────────────────── */

async function ensureIndexes(
  col: Collection<ExecutionTraceDoc>,
): Promise<void> {
  await Promise.all(
    SABFLOW_EXECUTION_TRACES_INDEX_SPECS.map((spec) =>
      col.createIndex(spec.keys, spec.options),
    ),
  );
}

let collectionPromise: Promise<Collection<ExecutionTraceDoc>> | null = null;

/**
 * Returns the typed `sabflow_execution_traces` collection, bootstrapping
 * indexes on first call. Subsequent calls reuse the cached promise.
 *
 * The one-shot init script (`scripts/sabflow/init-execution-traces.mjs`)
 * runs the same `createIndex` set out-of-band so production deploys don't
 * pay the bootstrap cost on the first request.
 */
export async function getExecutionTraceCollection(): Promise<
  Collection<ExecutionTraceDoc>
> {
  if (collectionPromise) return collectionPromise;
  collectionPromise = (async () => {
    const { db } = await connectToDatabase();
    const col = (db as Db).collection<ExecutionTraceDoc>(
      SABFLOW_EXECUTION_TRACES_COLLECTION,
    );
    await ensureIndexes(col);
    return col;
  })();
  return collectionPromise;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ──────────────────────────────────────────────────────────────────────── */

function toObjectId(value: ObjectId | string): ObjectId {
  return typeof value === 'string' ? new ObjectId(value) : value;
}

/**
 * Computes the default TTL anchor for a freshly-created trace doc.
 * Exported so callers (or tests) can compute the same value without
 * touching the system clock directly.
 */
export function computeTraceExpiresAt(
  now: Date,
  retentionDays: number = TRACE_DEFAULT_RETENTION_DAYS,
): Date {
  return new Date(now.getTime() + retentionDays * MS_PER_DAY);
}

/* ──────────────────────────────────────────────────────────────────────────
 * Writer API
 * ──────────────────────────────────────────────────────────────────────── */

export interface AppendTraceEventOpts {
  /**
   * Required when the trace doc may not yet exist (the upsert path). We need
   * a workspace scope to satisfy the multi-tenant invariant. If the doc
   * already exists this is ignored on update.
   */
  workspaceId: ObjectId | string;
  /** Allow callers to inject a fixed clock for tests. */
  now?: () => Date;
  /** Override the retention window on initial creation. Ignored on update. */
  retentionDays?: number;
}

/**
 * Append a single event to the trace doc for `executionId`. Upserts the
 * row on first append (the engine doesn't pre-create trace docs — the first
 * `node_start` lazily materialises one).
 *
 * `event.at` is preserved if the caller set it; otherwise it's stamped to
 * `now()`. Useful so persisted events match the wall-clock seen by the
 * in-process bus subscribers.
 */
export async function appendTraceEvent(
  executionId: ObjectId | string,
  event: TraceEvent,
  opts: AppendTraceEventOpts,
): Promise<void> {
  const col = await getExecutionTraceCollection();
  const now = (opts.now ?? (() => new Date()))();
  const retentionDays = opts.retentionDays ?? TRACE_DEFAULT_RETENTION_DAYS;

  const stamped: TraceEvent = {
    ...event,
    at: event.at ?? now,
  };

  await col.updateOne(
    { executionId: toObjectId(executionId) },
    {
      $push: { events: stamped },
      $set: { updatedAt: now },
      // Initial-creation defaults. Once the doc exists these are no-ops.
      $setOnInsert: {
        executionId: toObjectId(executionId),
        workspaceId: toObjectId(opts.workspaceId),
        pinned: false,
        expiresAt: computeTraceExpiresAt(now, retentionDays),
        createdAt: now,
      },
    },
    { upsert: true },
  );
}

/* ──────────────────────────────────────────────────────────────────────────
 * Reader API
 * ──────────────────────────────────────────────────────────────────────── */

export interface GetTraceOpts {
  /**
   * Tenant fence — if provided, the lookup also asserts the trace doc
   * belongs to this workspace. A mismatch returns `null` (no existence
   * leak). Strongly recommended for any caller exposing data over HTTP.
   */
  workspaceId?: ObjectId | string;
  /**
   * Cap on the number of events to project. Useful for the timeline UI
   * which only ever renders the most recent N. Omit for the full trace.
   */
  limitEvents?: number;
  /**
   * When `limitEvents` is set, choose which slice to take:
   *   - `'tail'` (default): most recent N events (uses `$slice: -N`).
   *   - `'head'`: oldest N events (uses `$slice: N`).
   */
  slice?: 'head' | 'tail';
}

/**
 * Fetch the full trace doc for `executionId`. Returns `null` if no trace
 * exists (engine never appended for this run) or if the workspace tenant
 * fence fails.
 */
export async function getTrace(
  executionId: ObjectId | string,
  opts: GetTraceOpts = {},
): Promise<ExecutionTraceDoc | null> {
  const col = await getExecutionTraceCollection();
  const filter: Record<string, unknown> = {
    executionId: toObjectId(executionId),
  };
  if (opts.workspaceId !== undefined) {
    filter.workspaceId = toObjectId(opts.workspaceId);
  }

  if (typeof opts.limitEvents === 'number' && opts.limitEvents > 0) {
    // Projection with `$slice` — server-side trim. `-N` returns the last N
    // entries, positive N returns the first N.
    const sliceArg =
      opts.slice === 'head' ? opts.limitEvents : -opts.limitEvents;
    const row = await col.findOne(filter, {
      projection: { events: { $slice: sliceArg } },
    });
    return row ?? null;
  }

  const row = await col.findOne(filter);
  return row ?? null;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Pin / unpin
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Pin a trace doc — clears `expiresAt` so the TTL monitor skips the row.
 *
 * Idempotent: calling twice on a pinned row is a no-op. Returns `true` if
 * the row was matched (regardless of whether it changed).
 */
export async function pinTrace(
  executionId: ObjectId | string,
  workspaceId: ObjectId | string,
): Promise<boolean> {
  const col = await getExecutionTraceCollection();
  const res = await col.updateOne(
    {
      executionId: toObjectId(executionId),
      workspaceId: toObjectId(workspaceId),
    },
    {
      $set: {
        pinned: true,
        expiresAt: null,
        updatedAt: new Date(),
      },
    },
  );
  return res.matchedCount > 0;
}

/**
 * Unpin a trace doc — re-anchors `expiresAt` to `now + retentionDays`,
 * letting the TTL monitor pick it up again.
 */
export async function unpinTrace(
  executionId: ObjectId | string,
  workspaceId: ObjectId | string,
  retentionDays: number = TRACE_DEFAULT_RETENTION_DAYS,
): Promise<boolean> {
  const col = await getExecutionTraceCollection();
  const now = new Date();
  const res = await col.updateOne(
    {
      executionId: toObjectId(executionId),
      workspaceId: toObjectId(workspaceId),
    },
    {
      $set: {
        pinned: false,
        expiresAt: computeTraceExpiresAt(now, retentionDays),
        updatedAt: now,
      },
    },
  );
  return res.matchedCount > 0;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Out-of-band index bootstrap — used by the one-shot init script
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * Idempotent index bootstrap for the `sabflow_execution_traces` collection.
 * Identical to what `getExecutionTraceCollection` does lazily, but takes a
 * `Db` so a standalone migration script can run without leaking the cached
 * collection promise back into the long-lived module state.
 */
export async function ensureExecutionTraceIndexes(db: Db): Promise<void> {
  const col = db.collection<ExecutionTraceDoc>(
    SABFLOW_EXECUTION_TRACES_COLLECTION,
  );
  for (const spec of SABFLOW_EXECUTION_TRACES_INDEX_SPECS) {
    await col.createIndex(spec.keys, spec.options);
  }
}
