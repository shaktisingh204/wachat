/**
 * SabFlow BullMQ execution worker.
 *
 * Pulls jobs from the "sabflow:executions" queue and runs the SabFlow
 * execution engine. Writes per-execution status and results to
 * the "sabflow_executions" MongoDB collection.
 *
 * Run via PM2 or `ts-node src/workers/sabflow-worker.ts`.
 */

import 'dotenv/config';
import { Worker, type Job } from 'bullmq';
import { MongoClient } from 'mongodb';
import Redis from 'ioredis';
import { SABFLOW_QUEUE, SABFLOW_EXEC_CHANNEL } from '@/lib/sabflow/worker/queues';

// ── Redis connection ────────────────────────────────────────────────────────

const connection = {
  host: process.env.REDIS_HOST ?? 'localhost',
  port: Number(process.env.REDIS_PORT ?? 6379),
  ...(process.env.REDIS_PASSWORD ? { password: process.env.REDIS_PASSWORD } : {}),
};

// Separate ioredis client for pub/sub publish (BullMQ uses its own connection)
let redisPublisher: Redis | null = null;

async function getRedisPublisher(): Promise<Redis> {
  if (!redisPublisher) {
    redisPublisher = new Redis({
      ...connection,
      lazyConnect: true,
      enableReadyCheck: false,
    });
    await redisPublisher.connect();
  }
  return redisPublisher;
}

async function publishStatus(executionId: string, status: Record<string, unknown>): Promise<void> {
  try {
    const publisher = await getRedisPublisher();
    await publisher.publish(SABFLOW_EXEC_CHANNEL(executionId), JSON.stringify(status));
  } catch {
    // non-fatal — SSE will fall back to polling
  }
}

// ── MongoDB connection (isolated from Next.js pool) ─────────────────────────

const MONGODB_URI = process.env.MONGODB_URI ?? '';
const MONGODB_DB = process.env.MONGODB_DB ?? '';

let mongoClient: MongoClient | null = null;

async function getDb() {
  if (!mongoClient) {
    mongoClient = new MongoClient(MONGODB_URI, { maxPoolSize: 5 });
    await mongoClient.connect();
  }
  return mongoClient.db(MONGODB_DB);
}

// ── Job payload type ────────────────────────────────────────────────────────

interface ExecutionJobPayload {
  executionId: string;
  flowId: string;
  projectId: string;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  flowSnapshot: any;
  triggerMode: string;
  triggerData?: unknown;
  variables: Record<string, string>;
}

// ── Processor ──────────────────────────────────────────────────────────────

async function processExecution(job: Job<ExecutionJobPayload>): Promise<void> {
  const { executionId, flowId, flowSnapshot, variables, triggerData } = job.data;

  console.log(`[sabflow-worker] execution ${executionId} starting (flow ${flowId})`);

  const db = await getDb();
  const execCol = db.collection('sabflow_executions');

  const startedAt = new Date();
  await execCol.updateOne(
    { executionId },
    { $set: { status: 'running', startedAt } },
  );
  await publishStatus(executionId, { status: 'running', startedAt });

  const start = Date.now();

  try {
    // Dynamic imports keep the worker start-up fast and avoid pulling
    // server-only Next.js internals before they are needed.
    const { executeFlow } = await import('@/lib/sabflow/engine/executeFlow');
    const { findStartGroup } = await import('@/lib/sabflow/start');

    const flow = flowSnapshot;
    const startGroup = findStartGroup(flow) ?? flow.groups?.[0];
    if (!startGroup) throw new Error('Flow has no start group');

    const initialVariables: Record<string, string> = {
      ...variables,
      ...(triggerData ? { $trigger: JSON.stringify(triggerData) } : {}),
    };

    const session = {
      flowId,
      currentGroupId: startGroup.id as string,
      currentBlockIndex: 0,
      variables: initialVariables,
      history: [] as Array<{ groupId: string; blockId: string; blockType: string; input?: string; output?: string; timestamp: Date }>,
    };

    const { result } = await executeFlow(flow, session);

    const durationMs = Date.now() - start;
    const finishedAt = new Date();
    await execCol.updateOne(
      { executionId },
      {
        $set: {
          status: 'success',
          finishedAt,
          durationMs,
          updatedVariables: result.updatedVariables,
        },
      },
    );
    await publishStatus(executionId, { status: 'success', finishedAt, durationMs });

    console.log(`[sabflow-worker] execution ${executionId} completed in ${durationMs}ms`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[sabflow-worker] execution ${executionId} failed: ${errMsg}`);

    const durationMs = Date.now() - start;
    const finishedAt = new Date();
    await execCol.updateOne(
      { executionId },
      {
        $set: {
          status: 'error',
          finishedAt,
          durationMs,
          error: errMsg,
        },
      },
    );
    await publishStatus(executionId, { status: 'error', finishedAt, durationMs, error: errMsg });

    // Re-throw so BullMQ can apply retry/backoff logic.
    throw err;
  }
}

// ── Worker bootstrap ────────────────────────────────────────────────────────

const concurrency = Number(process.env.SABFLOW_WORKER_CONCURRENCY ?? 10);

const worker = new Worker<ExecutionJobPayload>(SABFLOW_QUEUE, processExecution, {
  connection,
  concurrency,
});

worker.on('completed', (job) => {
  console.log(`[sabflow-worker] job ${job.id} completed`);
});

worker.on('failed', (job, err) => {
  console.error(`[sabflow-worker] job ${job?.id} failed:`, err.message);
});

worker.on('error', (err) => {
  console.error('[sabflow-worker] worker error:', err);
});

console.log(
  `[sabflow-worker] listening on queue "${SABFLOW_QUEUE}" concurrency=${concurrency}`,
);
