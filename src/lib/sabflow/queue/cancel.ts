/**
 * Admin/editor-side cancellation API for SabFlow executions.
 *
 * Pairs with the Rust worker module
 * `rust/crates/sabflow-executor/queue/src/cancel.rs` (Track B / Phase 2
 * sub-task #9 of 10). The Rust side honours the cooperative signal; we
 * publish it here and fall back to a hard-kill if the worker doesn't
 * transition the row within 10 s.
 *
 * Wire flow:
 *
 *   admin clicks "Cancel"
 *     -> cancelExecution()
 *        -> HSET sabflow:job:<id>  cancelRequestedAt / cancelRequestedBy
 *        -> PUBLISH sabflow:cancel:<id>
 *        -> watch the execution row for 10 s
 *           -> status === 'canceled'  =>  { mode: 'cooperative' }
 *           -> still 'running'         =>  drop the Redis lock, return
 *                                          { mode: 'hard' }; sibling #8
 *                                          (drain) evicts the stuck
 *                                          worker and a fresh worker
 *                                          finalises the row as
 *                                          'crashed'.
 */

import 'server-only';

import IORedis, { type Redis } from 'ioredis';

import { getExecutionById } from '@/lib/sabflow/db';

/* ── Public Redis key/channel shapes ─────────────────────────── */

/** Hash that carries the cooperative-cancel metadata for a single job. */
export const SABFLOW_JOB_HASH = (executionId: string): string =>
  `sabflow:job:${executionId}`;

/** Pubsub channel the Rust dispatcher subscribes to via PSUBSCRIBE. */
export const SABFLOW_CANCEL_CHANNEL = (executionId: string): string =>
  `sabflow:cancel:${executionId}`;

/** Worker lease lock. Siblings #1/#8 own this — we only DEL on hard-kill. */
export const SABFLOW_WORKER_LOCK = (executionId: string): string =>
  `sabflow:lock:${executionId}`;

/* ── Tunables (exported so the spec / sibling #8 can reuse) ──── */

/** How long we wait for the worker to honour the cooperative signal. */
export const COOPERATIVE_CANCEL_TIMEOUT_MS = 10_000;

/** Poll interval while waiting for the row to flip to `canceled`. */
const POLL_INTERVAL_MS = 250;

/* ── Types ─────────────────────────────────────────────────────── */

export type CancelMode = 'cooperative' | 'hard';

export interface CancelExecutionInput {
  workspaceId: string;
  executionId: string;
  /** User who requested the cancel — recorded on the job hash for audit. */
  requestedBy: string;
}

export interface CancelExecutionResult {
  ok: true;
  mode: CancelMode;
}

/* ── Redis singleton ───────────────────────────────────────────── */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

declare global {
  // eslint-disable-next-line no-var
  var __sabflowCancelRedis: Redis | undefined;
}

function getRedis(): Redis {
  if (globalThis.__sabflowCancelRedis) return globalThis.__sabflowCancelRedis;
  const client = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: false,
  });
  globalThis.__sabflowCancelRedis = client;
  return client;
}

/* ── Test seam ─────────────────────────────────────────────────── */

/**
 * Allow tests / sibling #4 to inject an alternative "has this row
 * transitioned to canceled?" probe without spinning up Mongo. Defaults
 * to the canonical `getExecutionById` lookup.
 */
type IsCanceled = (executionId: string) => Promise<boolean>;

let isCanceledImpl: IsCanceled = defaultIsCanceled;

async function defaultIsCanceled(executionId: string): Promise<boolean> {
  const row = await getExecutionById(executionId);
  if (!row) return false;
  // Accept both spellings: the existing TS type uses `cancelled` (en-GB)
  // while sibling #4's executor state machine speaks `canceled` (en-US).
  // Either is a terminal cancel state for our purposes.
  const status = row.status as string;
  return status === 'canceled' || status === 'cancelled';
}

/** Test-only: swap the row-status probe. */
export function __setIsCanceledForTests(fn: IsCanceled | null): void {
  isCanceledImpl = fn ?? defaultIsCanceled;
}

/* ── Public API ────────────────────────────────────────────────── */

/**
 * Cancel a running execution.
 *
 * 1. Stamps the job hash with `cancelRequestedAt` / `cancelRequestedBy`
 *    so the worker has a durable record even if it missed the pubsub
 *    fan-out (cold connect / replica failover).
 * 2. Publishes on `sabflow:cancel:<executionId>` for any in-flight
 *    worker to pick up immediately via the Rust pubsub listener.
 * 3. Polls the execution row for up to 10 s. If the row flips to
 *    `canceled`, returns `{ mode: 'cooperative' }`. Otherwise drops
 *    the worker's Redis lock so sibling #8's drain logic can evict
 *    the stuck worker, and returns `{ mode: 'hard' }`.
 *
 * The caller is responsible for authz (only members of `workspaceId`
 * who have the `flows.execution.cancel` RBAC key may invoke this).
 */
export async function cancelExecution(
  input: CancelExecutionInput,
): Promise<CancelExecutionResult> {
  const { workspaceId, executionId, requestedBy } = input;
  if (!executionId) throw new Error('executionId is required');
  if (!workspaceId) throw new Error('workspaceId is required');
  if (!requestedBy) throw new Error('requestedBy is required');

  const redis = getRedis();
  const now = Date.now();

  // (1) Stamp the job hash. We pipeline the HSET + PUBLISH so the
  //     metadata is durable before the fan-out lands, otherwise a
  //     worker that wakes up between the two writes could honour
  //     the signal without ever seeing who asked for it.
  const pipeline = redis.pipeline();
  pipeline.hset(SABFLOW_JOB_HASH(executionId), {
    cancelRequestedAt: String(now),
    cancelRequestedBy: requestedBy,
    cancelRequestedWorkspace: workspaceId,
  });
  pipeline.publish(
    SABFLOW_CANCEL_CHANNEL(executionId),
    JSON.stringify({ executionId, requestedBy, ts: now }),
  );
  await pipeline.exec();

  // (2) Cooperative wait. We poll instead of subscribing to a "row
  //     transitioned" event because the row-update path goes through
  //     Mongo, not Redis, and we don't want this admin call to depend
  //     on a (yet-to-be-built) Mongo change-stream watcher.
  const deadline = now + COOPERATIVE_CANCEL_TIMEOUT_MS;
  while (Date.now() < deadline) {
    if (await isCanceledImpl(executionId)) {
      return { ok: true, mode: 'cooperative' };
    }
    await sleep(POLL_INTERVAL_MS);
  }

  // (3) Hard-kill path. Drop the worker's lock — sibling #8's drain
  //     loop polls the lock TTL and evicts workers whose lock has
  //     gone missing; a fresh worker then picks the orphaned row up
  //     and finalises it as `crashed`. We deliberately do NOT touch
  //     the Mongo row here: that's sibling #4's job, and racing it
  //     would risk overwriting a `succeeded` row whose update was
  //     in flight when we crossed the deadline.
  await redis.del(SABFLOW_WORKER_LOCK(executionId));

  return { ok: true, mode: 'hard' };
}

/* ── Helpers ───────────────────────────────────────────────────── */

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
