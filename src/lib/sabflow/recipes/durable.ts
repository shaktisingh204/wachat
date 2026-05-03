/**
 * Durable execution wrapper for SabFlow.
 *
 * `runDurable()` runs a flow while persisting a checkpoint after every
 * block.  If the worker process restarts mid-execution, the next call with
 * the same `executionId` resumes from the last checkpoint instead of
 * replaying the entire flow.
 *
 * Checkpoints live in the `sabflow_checkpoints` Mongo collection.
 * BullMQ is used as the worker transport so durability extends across
 * process boundaries (the queue retries jobs whose worker died).
 */

import 'server-only';
import { Queue, type JobsOptions } from 'bullmq';
import IORedis, { Redis } from 'ioredis';
import { ObjectId, type Collection } from 'mongodb';
import { connectToDatabase } from '@/lib/mongodb';
import { executeFlow } from '@/lib/sabflow/engine';
import type { SabFlowDoc } from '@/lib/sabflow/types';
import type { SessionState, ExecutionResult } from '@/lib/sabflow/engine/types';

/* ── Types ──────────────────────────────────────────────── */

/**
 * Persisted state for a single durable run.  The combination of
 * `(executionId)` is unique; checkpoints are upserted on every step.
 */
export type DurableCheckpoint = {
  _id?: ObjectId;
  /** Unique id for this run.  Reused across resumes. */
  executionId: string;
  flowId: string;
  tenantId: string;
  /** Current engine session — re-played in `executeFlow()`. */
  session: SessionState;
  /** Last messages produced (for replay UI). */
  lastMessages: ExecutionResult['messages'];
  /** Whether the flow has finished. */
  isCompleted: boolean;
  /** Failure message when the run errored irrecoverably. */
  error?: string;
  createdAt: Date;
  updatedAt: Date;
};

/** Caller context for `runDurable()`. */
export type DurableContext = {
  /** Stable id for this run.  Generated when omitted. */
  executionId?: string;
  tenantId: string;
  /** Initial session — only used when no checkpoint exists yet. */
  initialSession: SessionState;
  /** Optional user input applied to the next paused input block. */
  userInput?: string;
};

export type DurableRunResult = {
  executionId: string;
  result: ExecutionResult;
  checkpoint: DurableCheckpoint;
};

/* ── Mongo collection helper ────────────────────────────── */

const COLLECTION = 'sabflow_checkpoints';

async function getCheckpointCollection(): Promise<Collection<DurableCheckpoint>> {
  const { db } = await connectToDatabase();
  const col = db.collection<DurableCheckpoint>(COLLECTION);
  await col.createIndex({ executionId: 1 }, { unique: true, background: true });
  await col.createIndex({ flowId: 1, updatedAt: -1 }, { background: true });
  return col;
}

/* ── BullMQ queue (singleton) ───────────────────────────── */

const REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379';

declare global {
  // eslint-disable-next-line no-var
  var __sabflowDurableRedis: Redis | undefined;
  // eslint-disable-next-line no-var
  var __sabflowDurableQueue: Queue | undefined;
}

function getRedis(): Redis {
  if (globalThis.__sabflowDurableRedis) return globalThis.__sabflowDurableRedis;
  const redis = new IORedis(REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
  });
  globalThis.__sabflowDurableRedis = redis;
  return redis;
}

export const SABFLOW_DURABLE_QUEUE = 'sabflow-durable';

/** Lazy queue accessor — created on first use to avoid eager Redis dial. */
export function getDurableQueue(): Queue {
  if (globalThis.__sabflowDurableQueue) return globalThis.__sabflowDurableQueue;
  const queue = new Queue(SABFLOW_DURABLE_QUEUE, {
    connection: getRedis(),
    defaultJobOptions: {
      attempts: 5,
      backoff: { type: 'exponential', delay: 5000 },
      removeOnComplete: { age: 24 * 3600, count: 1000 },
      removeOnFail: { age: 7 * 24 * 3600 },
    },
  });
  globalThis.__sabflowDurableQueue = queue;
  return queue;
}

/* ── Public checkpoint API ──────────────────────────────── */

/** Returns a single checkpoint or `null` when none exists. */
export async function getCheckpoint(
  executionId: string,
): Promise<DurableCheckpoint | null> {
  const col = await getCheckpointCollection();
  return col.findOne({ executionId });
}

/** Lists every checkpoint for the given flow (newest first). */
export async function listCheckpoints(
  flowId: string,
  limit = 50,
): Promise<DurableCheckpoint[]> {
  const col = await getCheckpointCollection();
  return col.find({ flowId }).sort({ updatedAt: -1 }).limit(limit).toArray();
}

/** Upsert the checkpoint by `executionId`. */
async function saveCheckpoint(checkpoint: DurableCheckpoint): Promise<void> {
  const col = await getCheckpointCollection();
  await col.replaceOne(
    { executionId: checkpoint.executionId },
    checkpoint,
    { upsert: true },
  );
}

/* ── runDurable ─────────────────────────────────────────── */

function generateExecutionId(): string {
  return new ObjectId().toHexString();
}

/**
 * Drive `executeFlow()` once and persist the resulting checkpoint.
 *
 * If a checkpoint already exists for `ctx.executionId`, the saved session
 * is used as the starting point — making this safe to call repeatedly
 * after a worker restart.
 *
 * The function always returns: it does **not** loop until completion
 * inside one call.  Long-running flows are advanced step-wise by the
 * BullMQ worker, which re-enqueues itself via `enqueueDurable()` after
 * each step.
 */
export async function runDurable(
  flow: SabFlowDoc,
  ctx: DurableContext,
): Promise<DurableRunResult> {
  const flowId = flow._id?.toHexString() ?? '';
  const executionId = ctx.executionId ?? generateExecutionId();

  // Resume from existing checkpoint when present.
  const existing = await getCheckpoint(executionId);
  const session = existing?.session ?? ctx.initialSession;

  let result: ExecutionResult;
  let updatedSession: SessionState;
  let error: string | undefined;

  try {
    const out = await executeFlow(flow, session, ctx.userInput);
    result = out.result;
    updatedSession = out.updatedSession;
  } catch (err) {
    error = err instanceof Error ? err.message : String(err);
    result = {
      messages: existing?.lastMessages ?? [],
      isCompleted: true,
      updatedVariables: session.variables,
    };
    updatedSession = session;
  }

  const now = new Date();
  const checkpoint: DurableCheckpoint = {
    executionId,
    flowId,
    tenantId: ctx.tenantId,
    session: updatedSession,
    lastMessages: result.messages,
    isCompleted: result.isCompleted,
    error,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
  };

  await saveCheckpoint(checkpoint);

  return { executionId, result, checkpoint };
}

/**
 * Enqueue a continuation job on BullMQ.  When the flow paused on a wait
 * block, the caller sets `delayMs` so the worker doesn't dequeue it until
 * the wait expires.
 */
export async function enqueueDurable(
  payload: {
    flowId: string;
    executionId: string;
    tenantId: string;
    userInput?: string;
  },
  options?: JobsOptions,
): Promise<void> {
  const queue = getDurableQueue();
  await queue.add('continue', payload, {
    jobId: payload.executionId,
    ...options,
  });
}
