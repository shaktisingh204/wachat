/**
 * SabFlow — BullMQ producer for the PM2 worker.
 *
 * Pushes execution jobs onto the `sabflow-executions` BullMQ queue that
 * `src/workers/sabflow-worker.ts` consumes (Rust engine with TS fallback).
 * The payload shape mirrors the worker's `ExecutionJobPayload` and the job
 * options mirror the webhook receiver's — keep all three in sync.
 *
 * This is the queue that actually runs in production. The Bull-compatible
 * Redis schema in `./enqueue.ts` (`sabflow:executions`) was built for the
 * Rust dispatcher loop (`rust/crates/sabflow-executor/queue`), which is not
 * yet compiled into any deployed binary — jobs pushed there are never
 * consumed. Producers that need a run to actually happen must use this
 * module.
 */

import { Queue } from 'bullmq';

import { SABFLOW_QUEUE } from '@/lib/sabflow/worker/queues';

/** Matches `ExecutionJobPayload` in src/workers/sabflow-worker.ts. */
export interface WorkerExecutionJob {
  executionId: string;
  flowId: string;
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flowSnapshot: any;
  triggerMode: string;
  triggerData?: unknown;
  variables: Record<string, string>;
}

let _queue: Queue | null = null;

function getQueue(): Queue {
  if (_queue) return _queue;
  const connection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: Number(process.env.REDIS_PORT || 6379),
    ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
  };
  _queue = new Queue(SABFLOW_QUEUE, { connection });
  return _queue;
}

/**
 * Enqueue an execution for the PM2 sabflow-worker. Resolves with the BullMQ
 * job id; throws when Redis is unreachable (callers should fall back to
 * direct in-process execution where that makes sense).
 *
 * `opts.jobId` opts into BullMQ's jobId-based de-duplication: a second add
 * with the same id is a no-op while the original job still exists (i.e.
 * until removeOnComplete/Fail prunes it). Use for replayed/retried trigger
 * fires where the caller also keeps a durable seen-set.
 */
export async function enqueueWorkerExecution(
  payload: WorkerExecutionJob,
  opts?: { jobId?: string },
): Promise<string> {
  const job = await getQueue().add('execute', payload, {
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 500 },
    attempts: 3,
    backoff: { type: 'exponential', delay: 2000 },
    ...(opts?.jobId ? { jobId: opts.jobId } : {}),
  });
  return String(job.id ?? payload.executionId);
}
