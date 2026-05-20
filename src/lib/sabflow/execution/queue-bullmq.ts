/**
 * BullMQ-backed execution queue.
 *
 * Opt-in: only loaded by `queue.ts` when `SABFLOW_QUEUE_REDIS_URL` is set.
 * Keeps `bullmq` + `ioredis` out of bundles for deployments that don't
 * want distributed queueing.
 *
 * What this gives you over the in-memory backend:
 *   - Multi-instance worker fan-out (run N workers against the same Redis)
 *   - At-least-once delivery with configurable retries + backoff
 *   - Dead-letter queue for jobs that exceed max retries
 *   - Survives a process crash mid-job (the worker re-claims it on restart)
 *
 * What this does NOT give you (yet):
 *   - Job priorities, rate limits, or scheduled execution. Add when needed.
 *   - Cross-region failover. Single Redis = single point of failure for the
 *     queue layer; flow state itself is durable in the SabFlow DB.
 *
 * The worker side is registered exactly ONCE per process via
 * `registerHandler`. For a dedicated worker fleet, run a thin Node process
 * whose entry point calls `getExecutionQueue().registerHandler(runJob)`
 * and then sleeps — BullMQ takes care of polling Redis.
 */

import { Queue, Worker, type Job } from 'bullmq';
import IORedis from 'ioredis';

import type {
  ExecutionJobHandler,
  ExecutionJobPayload,
  ExecutionQueue,
} from './queue';

const QUEUE_NAME = 'sabflow.executions';

class BullMqExecutionQueue implements ExecutionQueue {
  readonly backend = 'bullmq' as const;
  private readonly connection: IORedis;
  private readonly queue: Queue<ExecutionJobPayload>;
  private worker: Worker<ExecutionJobPayload> | null = null;

  constructor(redisUrl: string) {
    // `maxRetriesPerRequest: null` is required by BullMQ for the workers'
    // BLPOP-style blocking commands — otherwise ioredis aborts them.
    this.connection = new IORedis(redisUrl, { maxRetriesPerRequest: null });
    this.queue = new Queue<ExecutionJobPayload>(QUEUE_NAME, {
      connection: this.connection,
      defaultJobOptions: {
        attempts: 3,
        backoff: { type: 'exponential', delay: 1_000 },
        removeOnComplete: { age: 24 * 3600, count: 5_000 },
        removeOnFail: { age: 7 * 24 * 3600 },
      },
    });
  }

  registerHandler(handler: ExecutionJobHandler): void {
    if (this.worker) {
      throw new Error(
        'BullMqExecutionQueue.registerHandler: handler already registered',
      );
    }
    this.worker = new Worker<ExecutionJobPayload>(
      QUEUE_NAME,
      async (job: Job<ExecutionJobPayload>) => {
        await handler(job.data);
      },
      {
        connection: this.connection,
        // One job per worker at a time keeps execution semantics simple
        // (no shared in-process state between concurrent jobs). Operators
        // wanting more throughput run more worker processes instead.
        concurrency: 1,
      },
    );
    this.worker.on('failed', (job, err) => {
      // eslint-disable-next-line no-console
      console.error(
        `[sabflow.queue] bullmq job ${job?.id} failed (attempts=${job?.attemptsMade}):`,
        err?.message ?? err,
      );
    });
  }

  async enqueue(payload: ExecutionJobPayload): Promise<string> {
    // Dedup key: when the caller supplied an `executionId`, reuse it as
    // the job id so a webhook retry re-claims the same job instead of
    // double-enqueuing.
    const jobId = payload.executionId;
    const job = await this.queue.add('execute', payload, jobId ? { jobId } : undefined);
    return String(job.id);
  }
}

/** Factory used by `queue.ts`'s dynamic loader. */
export function makeBullMqQueue(redisUrl: string): ExecutionQueue {
  return new BullMqExecutionQueue(redisUrl);
}
