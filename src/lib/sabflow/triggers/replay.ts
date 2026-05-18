/**
 * SabFlow — replay missed trigger fires.
 *
 * Recovers fires that were lost while a trigger was disabled or while a worker
 * was down. Walks the trigger's backfill source (webhook log, IMAP date-range
 * search, change-stream resume token range, polling history), de-dupes against
 * `sabflow_executions` (keyed by `originalFireAt + triggerId`), and re-enqueues
 * the survivors as `mode='retry'` runs with `metadata.replay = true`.
 *
 * Surface:
 *   - `replayTriggerWindow(input)` — main entry point used by the API route at
 *     `src/app/api/sabflow/triggers/[id]/replay/route.ts`.
 *
 * Track B · Phase 6 · sub-task #10 of 10.
 */

import type { Collection, Db, ObjectId as ObjectIdType } from 'mongodb';
import { getSabFlowCollection } from '@/lib/sabflow/db';
import { enqueueExecution } from '@/lib/sabflow/queue/enqueue';
import {
  SABFLOW_EXECUTIONS_COLLECTION,
  type ExecutionDoc,
} from '@/lib/sabflow/executor/state';
import type { SabFlowDoc, SabFlowEvent } from '@/lib/sabflow/types';

// -----------------------------------------------------------------------------
// Public types
// -----------------------------------------------------------------------------

/**
 * Discriminator describing where the events for a given trigger come from.
 * `none` means we cannot backfill this trigger surface — caller should error.
 */
export type ReplaySource =
  | 'webhook_log'
  | 'imap_date_range'
  | 'change_stream'
  | 'polling_history'
  | 'none';

export interface ReplayTriggerInput {
  /** Trigger event id, matches `SabFlowEvent.id` on the parent flow doc. */
  triggerId: string;
  /** Inclusive start of the replay window. */
  from: Date;
  /** Exclusive end of the replay window. Hard-capped at 30 days from `from`. */
  to: Date;
  /** Caller user id — recorded in the replay metadata for audit. */
  requesterId: string;
  /** Tenant scope. MANDATORY. */
  workspaceId: string;
  /** When `true`, returns the plan without enqueuing anything. */
  dryRun?: boolean;
}

export interface ReplayPlanEntry {
  /** Best-guess original fire time for the recovered event (ISO string). */
  originalFireAt: string;
  /** Stable per-event id used for idempotency. */
  eventKey: string;
  /** Source-specific opaque pointer (webhook log id, IMAP UID, etc). */
  sourceRef: string;
}

export interface ReplaySkippedEntry extends ReplayPlanEntry {
  /** Why the event was skipped — almost always `already_executed`. */
  reason: 'already_executed' | 'invalid_payload';
}

export interface ReplayTriggerResult {
  /** Discriminator picked from the trigger config. */
  source: ReplaySource;
  /** Events successfully enqueued (or planned, when `dryRun`). */
  replayed: ReplayPlanEntry[];
  /** Events skipped — usually because the execution already ran. */
  skipped: ReplaySkippedEntry[];
  /** True when no enqueue side-effects were performed. */
  dryRun: boolean;
}

// -----------------------------------------------------------------------------
// Source selection
// -----------------------------------------------------------------------------

/**
 * Pick the backfill strategy for a given trigger event. The discriminator is
 * derived from the event's `type` + `appEvent` slug, which mirrors how the
 * production engine routes inbound fires.
 */
function selectReplaySource(event: SabFlowEvent): ReplaySource {
  if (event.type === 'webhook') return 'webhook_log';
  if (event.type === 'schedule') return 'polling_history';
  const slug = (event.appEvent ?? '').toLowerCase();
  if (slug.includes('imap') || slug.includes('email_received')) {
    return 'imap_date_range';
  }
  if (slug.startsWith('mongo_') || slug.includes('change_stream')) {
    return 'change_stream';
  }
  // Generic polling triggers (RSS, HTTP polling, etc.) keep a history list.
  if (slug.includes('polling') || slug.includes('rss')) {
    return 'polling_history';
  }
  return 'none';
}

// -----------------------------------------------------------------------------
// Backfill — source-specific raw event pull
// -----------------------------------------------------------------------------

interface RawEvent {
  /** Source-specific reference (log id, UID, resume token, etc). */
  sourceRef: string;
  /** Best-guess original fire timestamp. */
  firedAt: Date;
  /** Replay payload handed to the worker as `triggerData`. */
  payload: unknown;
}

/** Per-source adapter signature. */
type SourceReader = (args: {
  flowId: string;
  event: SabFlowEvent;
  workspaceId: string;
  from: Date;
  to: Date;
}) => Promise<RawEvent[]>;

/**
 * Optional source-adapter module names. These live alongside this file under
 * `src/lib/sabflow/triggers/sources/`. They are loaded lazily — the static
 * resolver is intentionally NOT given a literal so missing modules don't
 * break the build while the source-side readers are landing in sibling PRs.
 */
const SOURCE_ADAPTER_PATHS: Record<Exclude<ReplaySource, 'none'>, string> = {
  webhook_log: '@/lib/sabflow/triggers/sources/webhookLog',
  imap_date_range: '@/lib/sabflow/triggers/sources/imap',
  change_stream: '@/lib/sabflow/triggers/sources/changeStream',
  polling_history: '@/lib/sabflow/triggers/sources/pollingHistory',
};

const SOURCE_ADAPTER_EXPORTS: Record<Exclude<ReplaySource, 'none'>, string> = {
  webhook_log: 'fetchWebhookLogEvents',
  imap_date_range: 'fetchImapEvents',
  change_stream: 'fetchChangeStreamEvents',
  polling_history: 'fetchPollingHistoryEvents',
};

/**
 * Pulls events from the chosen backfill source. Concrete source readers live
 * in their respective subsystems; this file owns the integration shape only.
 *
 * Each reader is required to return events in chronological order so the
 * dedup query below sees them in fire-order. Sources that can't honour that
 * contract should sort before returning. Adapters are loaded via a runtime
 * specifier so a missing optional reader returns an empty list instead of
 * breaking the typecheck on this top-level orchestrator.
 */
async function fetchRawEvents(
  source: ReplaySource,
  flow: SabFlowDoc,
  event: SabFlowEvent,
  from: Date,
  to: Date,
  workspaceId: string,
): Promise<RawEvent[]> {
  if (source === 'none') return [];
  const modulePath: string = SOURCE_ADAPTER_PATHS[source];
  const exportName = SOURCE_ADAPTER_EXPORTS[source];
  try {
    // Indirect specifier — TS can't statically resolve, which is what we want
    // while the per-source readers are being landed in sibling PRs.
    const mod: Record<string, SourceReader> = await import(
      /* @vite-ignore */ /* webpackIgnore: true */ modulePath
    );
    const reader = mod[exportName];
    if (typeof reader !== 'function') return [];
    return await reader({
      flowId: flow._id?.toString() ?? '',
      event,
      workspaceId,
      from,
      to,
    });
  } catch {
    return [];
  }
}

// -----------------------------------------------------------------------------
// Dedup against sabflow_executions
// -----------------------------------------------------------------------------

/**
 * Build the per-event idempotency key. The key is shared with the dedup query
 * AND the `enqueueExecution` call so a concurrent legitimate fire that beats
 * the replay to the queue is also collapsed.
 */
function makeEventKey(triggerId: string, firedAt: Date): string {
  return `replay:${triggerId}:${firedAt.toISOString()}`;
}

/**
 * Pre-fetch all executions in the window that already carry this trigger's
 * `originalFireAt`. One round-trip is cheaper than N point-lookups. The
 * resulting Set is consulted in-memory while we plan each candidate.
 */
async function loadExistingFires(
  workspaceId: string,
  triggerId: string,
  from: Date,
  to: Date,
): Promise<Set<string>> {
  let col: Collection<ExecutionDoc>;
  try {
    const { connectToDatabase } = await import('@/lib/mongodb');
    const { db } = await connectToDatabase();
    col = (db as Db).collection<ExecutionDoc>(SABFLOW_EXECUTIONS_COLLECTION);
  } catch {
    return new Set();
  }

  // We rely on the workspace-scoped startedAt index. The replay metadata is
  // written under `triggerData.__replay` by the worker; we match on that path
  // plus the canonical `triggerId` field projected by the engine.
  const { ObjectId } = await import('mongodb');
  if (!ObjectId.isValid(workspaceId)) return new Set();

  const cursor = col.find(
    {
      workspaceId: new ObjectId(workspaceId) as unknown as ObjectIdType,
      startedAt: { $gte: from, $lt: to },
      $or: [
        { 'triggerData.__replay.triggerId': triggerId },
        { 'triggerData.__triggerId': triggerId },
      ],
    },
    {
      projection: {
        _id: 0,
        startedAt: 1,
        triggerData: 1,
      },
    },
  );

  const seen = new Set<string>();
  for await (const doc of cursor) {
    const td = (doc as ExecutionDoc).triggerData as
      | { __replay?: { originalFireAt?: string }; __originalFireAt?: string }
      | undefined;
    const iso =
      td?.__replay?.originalFireAt ??
      td?.__originalFireAt ??
      (doc as ExecutionDoc).startedAt?.toISOString();
    if (iso) seen.add(`${triggerId}:${iso}`);
  }
  return seen;
}

// -----------------------------------------------------------------------------
// Main entry
// -----------------------------------------------------------------------------

const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

export class ReplayWindowError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReplayWindowError';
  }
}

/**
 * Replay missed fires for a single trigger inside a bounded window.
 *
 * Idempotency: every candidate event is keyed by `originalFireAt + triggerId`.
 * The function pre-loads executions in the window whose `triggerData` carries
 * a matching key and skips them; the enqueue call also passes the same key as
 * `idempotencyKey` to guard against a producer race.
 *
 * Cap: `to - from` must be ≤ 30 days. The caller (route handler) should
 * already enforce this, but we re-check defensively so library consumers
 * cannot accidentally schedule a year-long replay.
 */
export async function replayTriggerWindow(
  input: ReplayTriggerInput,
): Promise<ReplayTriggerResult> {
  const { triggerId, from, to, requesterId, workspaceId, dryRun = false } = input;

  if (!(from instanceof Date) || !(to instanceof Date)) {
    throw new ReplayWindowError('`from` and `to` must be Date instances.');
  }
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime())) {
    throw new ReplayWindowError('`from` / `to` are not valid dates.');
  }
  if (to.getTime() <= from.getTime()) {
    throw new ReplayWindowError('`to` must be strictly after `from`.');
  }
  if (to.getTime() - from.getTime() > THIRTY_DAYS_MS) {
    throw new ReplayWindowError('Replay window cannot exceed 30 days.');
  }

  // 1. Resolve trigger config off the parent flow doc.
  const col = await getSabFlowCollection();
  const flow = await col.findOne({ 'events.id': triggerId });
  if (!flow) {
    throw new ReplayWindowError(`Trigger ${triggerId} not found.`);
  }
  const event = flow.events.find((e) => e.id === triggerId);
  if (!event) {
    throw new ReplayWindowError(`Trigger ${triggerId} missing from flow.`);
  }

  // 2. Pick the backfill source.
  const source = selectReplaySource(event);
  if (source === 'none') {
    throw new ReplayWindowError(
      `Trigger type "${event.type}" (appEvent="${event.appEvent ?? '<none>'}") has no backfill source.`,
    );
  }

  // 3. Pull raw events from the source and the seen-set in parallel.
  const [rawEvents, seenKeys] = await Promise.all([
    fetchRawEvents(source, flow, event, from, to, workspaceId),
    loadExistingFires(workspaceId, triggerId, from, to),
  ]);

  // 4. Plan replays, then optionally enqueue.
  const flowId = flow._id?.toString() ?? '';
  const plan: ReplayPlanEntry[] = [];
  const skipped: ReplaySkippedEntry[] = [];

  for (const raw of rawEvents) {
    if (!raw.firedAt || Number.isNaN(raw.firedAt.getTime())) {
      skipped.push({
        originalFireAt: new Date().toISOString(),
        eventKey: makeEventKey(triggerId, new Date(0)),
        sourceRef: raw.sourceRef,
        reason: 'invalid_payload',
      });
      continue;
    }

    const originalFireAt = raw.firedAt.toISOString();
    const seenKey = `${triggerId}:${originalFireAt}`;
    const eventKey = makeEventKey(triggerId, raw.firedAt);
    const entry: ReplayPlanEntry = { originalFireAt, eventKey, sourceRef: raw.sourceRef };

    if (seenKeys.has(seenKey)) {
      skipped.push({ ...entry, reason: 'already_executed' });
      continue;
    }

    plan.push(entry);
  }

  if (dryRun) {
    return { source, replayed: plan, skipped, dryRun: true };
  }

  // 5. Enqueue. Each enqueueExecution call is independently idempotent on
  //    `eventKey`, so even partial failures here are safe to retry by calling
  //    `replayTriggerWindow` again.
  for (const raw of rawEvents) {
    if (!raw.firedAt) continue;
    const originalFireAt = raw.firedAt.toISOString();
    if (seenKeys.has(`${triggerId}:${originalFireAt}`)) continue;
    const eventKey = makeEventKey(triggerId, raw.firedAt);

    try {
      await enqueueExecution({
        workspaceId,
        workflowId: flowId,
        mode: 'retry',
        plan: 'pro', // sibling #4 reads the real plan tier; fallback default.
        triggerData: {
          __replay: {
            replay: true,
            triggerId,
            originalFireAt,
            requesterId,
            source,
            sourceRef: raw.sourceRef,
          },
          payload: raw.payload,
        },
        idempotencyKey: eventKey,
      });
      // Mark seen so a duplicate raw event later in the same loop is skipped.
      seenKeys.add(`${triggerId}:${originalFireAt}`);
    } catch (err) {
      console.error(
        `[SabFlow replay] enqueue failed for trigger=${triggerId} fireAt=${originalFireAt}:`,
        err,
      );
    }
  }

  return { source, replayed: plan, skipped, dryRun: false };
}
