/**
 * SabFlow execution queue — pluggable abstraction.
 *
 * Two backends ship in tree:
 *
 *   • InMemoryExecutionQueue (default, this file)
 *       Process-local. Hands the work to the existing concurrency gate +
 *       runs it inline. Zero external dependencies. Use for dev,
 *       single-instance deployments, and small workloads.
 *
 *   • BullMQ-backed queue (`./queue-bullmq.ts`, opt-in)
 *       Activates when `SABFLOW_QUEUE_REDIS_URL` is set. Real distributed
 *       queue with at-least-once delivery, retries, dead-letter, and
 *       cross-instance load balancing. Use for production scale + horizontal
 *       worker fan-out.
 *
 * Both implementations expose the same interface so callers (HTTP routes
 * that kick off runs, webhook handlers, schedulers) never need to know
 * which backend is live. Selection happens once at module load via
 * `getExecutionQueue()`.
 *
 * Wire format:
 *   - `enqueueExecution(payload)` returns a job id (opaque string).
 *   - `payload.flowId` + `payload.session` are enough to resume a run.
 *   - `runJob` is registered ONCE by the consumer route — the in-memory
 *     backend calls it immediately; the bullmq backend calls it when a
 *     worker picks the job off Redis.
 *
 * Caveat: the in-memory backend doesn't survive a process restart mid-run.
 * Long-running flows that pause for user input still persist via the
 * `SessionState` saved through executeFlow — this queue is for KICKING
 * OFF runs, not for durable state.
 */

import type { SessionState } from '@/lib/sabflow/engine/types';

export type ExecutionJobPayload = {
  /** Stable id of the flow to execute. */
  flowId: string;
  /** Session state (variables, current position, restored nodeOutputs). */
  session: SessionState;
  /** Optional user input that resumes a paused flow. */
  userInput?: string;
  /** Workspace owner — used by audit + per-workspace concurrency keys. */
  userId?: string;
  /** Caller's chosen execution id; the runner publishes traces under it. */
  executionId?: string;
  /** Forces a fresh start even if `session.currentBlockIndex > 0`. */
  startFresh?: boolean;
};

export type ExecutionJobHandler = (
  payload: ExecutionJobPayload,
) => Promise<void>;

export type ExecutionQueue = {
  /**
   * Enqueue a run. Returns an opaque job id. In-memory: runs inline (the
   * promise resolves only after the handler completes). BullMQ: returns
   * immediately after pushing the job; a worker picks it up.
   */
  enqueue: (payload: ExecutionJobPayload) => Promise<string>;
  /**
   * Register the handler that consumes jobs. Called ONCE per process at
   * boot — typically from the API route handler module. Calling twice
   * throws to surface accidental double-registration.
   */
  registerHandler: (handler: ExecutionJobHandler) => void;
  /** Backend identifier (for diagnostics + telemetry). */
  readonly backend: 'in-memory' | 'bullmq';
};

/** n8n-style job result envelope returned by `enqueue`. */

/* ── In-memory backend ──────────────────────────────────────────────────── */

class InMemoryExecutionQueue implements ExecutionQueue {
  readonly backend = 'in-memory' as const;
  private handler: ExecutionJobHandler | null = null;
  private counter = 0;

  registerHandler(handler: ExecutionJobHandler): void {
    if (this.handler) {
      throw new Error(
        'InMemoryExecutionQueue.registerHandler: handler already registered',
      );
    }
    this.handler = handler;
  }

  async enqueue(payload: ExecutionJobPayload): Promise<string> {
    if (!this.handler) {
      throw new Error(
        'InMemoryExecutionQueue.enqueue: no handler registered — call registerHandler first',
      );
    }
    this.counter += 1;
    const jobId = `mem_${Date.now().toString(36)}_${this.counter}`;
    // In-memory backend awaits the handler so the caller sees errors and
    // can roll back the persisted execution row on failure. Distributed
    // backends (BullMQ) return as soon as the job is enqueued — error
    // surfacing then goes via the trace bus + persisted ExecutionStep.
    await this.handler(payload);
    return jobId;
  }
}

/* ── Factory ────────────────────────────────────────────────────────────── */

let singleton: ExecutionQueue | null = null;

/**
 * Returns the process-wide execution queue. The first call decides the
 * backend (based on env); subsequent calls return the same instance so
 * `registerHandler` semantics stay consistent.
 *
 * Backend selection:
 *   • `SABFLOW_QUEUE_REDIS_URL` set → tries to load `./queue-bullmq.ts`
 *     (a dynamic import keeps `bullmq` out of bundles when not used).
 *     Falls back to in-memory if the import fails — logged to stderr so
 *     the misconfiguration is visible.
 *   • Otherwise → in-memory.
 */
export function getExecutionQueue(): ExecutionQueue {
  if (singleton) return singleton;
  const redisUrl = process.env.SABFLOW_QUEUE_REDIS_URL;
  if (redisUrl) {
    try {
      // Lazy require — `bullmq` is heavy and pulls in `ioredis`. Skipped
      // entirely when not configured.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const mod = require('./queue-bullmq') as {
        makeBullMqQueue: (url: string) => ExecutionQueue;
      };
      singleton = mod.makeBullMqQueue(redisUrl);
      return singleton;
    } catch (err) {
      // eslint-disable-next-line no-console
      console.warn(
        '[sabflow.queue] BullMQ backend requested via SABFLOW_QUEUE_REDIS_URL but failed to load — falling back to in-memory:',
        err instanceof Error ? err.message : String(err),
      );
    }
  }
  singleton = new InMemoryExecutionQueue();
  return singleton;
}

/**
 * Test-only escape hatch — resets the singleton so a fresh backend can
 * be installed in unit tests. Never call from production code.
 */
export function _resetExecutionQueueForTests(): void {
  singleton = null;
}
