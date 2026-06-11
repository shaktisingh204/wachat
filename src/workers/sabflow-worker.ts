/**
 * SabFlow BullMQ execution worker.
 *
 * Pulls jobs from the "sabflow-executions" queue and runs the SabFlow
 * execution engine. Writes per-execution status and results to
 * the "sabflow_executions" MongoDB collection.
 *
 * Primary path:   delegate to the Rust engine via
 *   `POST {RUST_API_URL}/v1/sabflow/internal/execute`.
 * Fallback path:  run the legacy in-process TypeScript engine when the Rust
 *   service is unreachable (connection refused, DNS failure, timeout, etc.).
 *
 * Run via PM2 or `ts-node src/workers/sabflow-worker.ts`.
 */

import 'dotenv/config';
import { createDecipheriv, createHash } from 'node:crypto';
import { Worker, type Job } from 'bullmq';
import { MongoClient, ObjectId, type Db } from 'mongodb';
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

async function getDb(): Promise<Db> {
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

/* ── Rust engine response shape ────────────────────────────────────────────
 *
 * Mirrors `ExecuteFlowOutput` in
 * rust/crates/sabflow-engine-runtime/src/engine.rs — plain serde derives,
 * so every field is snake_case. Keep in sync with that struct.
 */
interface RustNodeResult {
  block_id: string;
  block_type: string;
  status: string;
  output_branches: number;
  error?: string | null;
}

interface RustExecutionResult {
  execution_id: string;
  status: 'success' | 'error';
  error?: string | null;
  node_results?: RustNodeResult[];
  variables?: Record<string, unknown>;
}

/** Detect transport-level failures so we can fall back to the TS engine. */
function isConnectionError(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  // Node's undici fetch surfaces a `cause` with a `code` for socket errors.
  const cause = (err as unknown as { cause?: { code?: string } }).cause;
  const code = cause?.code;
  if (code && ['ECONNREFUSED', 'ECONNRESET', 'EAI_AGAIN', 'ENOTFOUND', 'ETIMEDOUT', 'UND_ERR_SOCKET'].includes(code)) {
    return true;
  }
  // Generic patterns — fetch occasionally throws "fetch failed".
  const msg = err.message.toLowerCase();
  return (
    msg.includes('fetch failed') ||
    msg.includes('econnrefused') ||
    msg.includes('socket hang up') ||
    msg.includes('network')
  );
}

// ── Credential forwarding (Rust engine) ────────────────────────────────────
//
// The Rust engine (`rust/crates/sabflow-engine-runtime`) expects
// `credentials: HashMap<credentialId, { id, credential_type, data }>` with
// every `data` value already decrypted (see `sabflow_nodes::Credential`).
//
// Decryption mirrors `src/lib/sabflow/credentials/encryption.ts`
// (AES-256-GCM, `base64(iv):base64(ciphertext):base64(authTag)`, key =
// sha256(CREDENTIALS_ENCRYPTION_KEY || NEXTAUTH_SECRET)). That module is
// `server-only` and this worker runs under tsx outside the Next.js runtime,
// so the small decrypt routine is replicated here instead of imported —
// keep the two in sync if the envelope format ever changes.

/** Decrypted credential record in the shape `sabflow_nodes::Credential` expects. */
interface RustCredential {
  id: string;
  credential_type: string;
  data: Record<string, string>;
}

function credentialKeyBuffer(): Buffer | null {
  const secret =
    process.env.CREDENTIALS_ENCRYPTION_KEY || process.env.NEXTAUTH_SECRET;
  if (!secret) return null;
  // Matches `resolveDefaultKey()` in credentials/encryption.ts — the env
  // secret is always run through SHA-256 to derive the 32-byte AES key.
  return createHash('sha256').update(secret, 'utf8').digest();
}

function decryptCredentialValue(encrypted: string, keyBuf: Buffer): string {
  const parts = encrypted.split(':');
  if (parts.length !== 3) {
    throw new Error('invalid payload shape (expected iv:ciphertext:tag)');
  }
  const [ivB64, dataB64, tagB64] = parts;
  const iv = Buffer.from(ivB64, 'base64');
  const decipher = createDecipheriv('aes-256-gcm', keyBuf, iv);
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}

/**
 * Walk the flow snapshot and collect every credential id its blocks
 * reference. Mirrors how the TS engine resolves credentials at run time
 * (`block.options.credentialId` for forge blocks, plus the legacy
 * `credentialsId` used by AI / email blocks).
 */
function collectCredentialIds(flowSnapshot: ExecutionJobPayload['flowSnapshot']): string[] {
  const ids = new Set<string>();
  for (const group of flowSnapshot?.groups ?? []) {
    for (const block of group?.blocks ?? []) {
      const opts = (block?.options ?? {}) as Record<string, unknown>;
      for (const candidate of [opts.credentialId, opts.credentialsId]) {
        if (typeof candidate === 'string' && candidate.trim()) {
          ids.add(candidate.trim());
        }
      }
    }
  }
  return [...ids];
}

/**
 * Fetches + decrypts the credentials referenced by the flow, scoped to the
 * flow's owner (credentials belonging to any other workspace are never
 * forwarded). Failures are non-fatal: the job proceeds with `{}` and the
 * affected nodes surface their own "missing credential" errors.
 */
async function loadFlowCredentials(
  payload: ExecutionJobPayload,
): Promise<Record<string, RustCredential>> {
  try {
    const ids = collectCredentialIds(payload.flowSnapshot);
    if (ids.length === 0) return {};

    const keyBuf = credentialKeyBuffer();
    if (!keyBuf) {
      console.warn(
        '[sabflow-worker] CREDENTIALS_ENCRYPTION_KEY / NEXTAUTH_SECRET not set — forwarding no credentials',
      );
      return {};
    }

    // Tenancy: only the flow owner's credentials may be forwarded.
    const ownerId = String(payload.flowSnapshot?.userId ?? payload.projectId ?? '');
    if (!ownerId) return {};

    const oids = ids.filter((id) => ObjectId.isValid(id)).map((id) => new ObjectId(id));
    if (oids.length === 0) return {};

    const db = await getDb();
    const docs = await db
      .collection('sabflow_credentials')
      .find({ _id: { $in: oids }, workspaceId: ownerId })
      .toArray();

    const out: Record<string, RustCredential> = {};
    for (const doc of docs) {
      const id = doc._id.toString();
      const data: Record<string, string> = {};
      const encrypted = (doc.data ?? {}) as Record<string, string>;
      for (const [field, value] of Object.entries(encrypted)) {
        try {
          data[field] = decryptCredentialValue(String(value), keyBuf);
        } catch {
          // Corrupt / legacy-plaintext value — mirror decryptRecord()'s
          // lenient behaviour and keep the rest of the record usable.
          data[field] = '';
        }
      }
      out[id] = { id, credential_type: String(doc.type ?? ''), data };
    }
    return out;
  } catch (err) {
    console.warn(
      '[sabflow-worker] failed to load credentials — continuing with {}:',
      err instanceof Error ? err.message : err,
    );
    return {};
  }
}

// ── Rust engine proxy ──────────────────────────────────────────────────────

async function rustExecuteFlow(payload: ExecutionJobPayload): Promise<RustExecutionResult> {
  const baseUrl = process.env.RUST_API_URL ?? 'http://localhost:3001';
  const credentials = await loadFlowCredentials(payload);
  const res = await fetch(`${baseUrl}/v1/sabflow/internal/execute`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    // Field names mirror `ExecuteFlowInput` in
    // rust/crates/sabflow-engine-runtime/src/engine.rs (plain serde derives →
    // snake_case). camelCase here fails deserialisation with a 422.
    body: JSON.stringify({
      execution_id: payload.executionId,
      flow: payload.flowSnapshot,
      trigger_data: payload.triggerData,
      variables: payload.variables,
      // Decrypted credentials keyed by credential id, scoped to the flow
      // owner — the shape `sabflow_nodes::Credential` deserialises.
      credentials,
    }),
  });
  if (!res.ok) {
    throw new Error(`Rust engine returned ${res.status}`);
  }
  return (await res.json()) as RustExecutionResult;
}

// ── Legacy TypeScript engine (fallback) ────────────────────────────────────

async function runWithTsEngine(payload: ExecutionJobPayload): Promise<void> {
  const { executionId, flowId, flowSnapshot, variables, triggerData } = payload;

  const db = await getDb();
  const execCol = db.collection('sabflow_executions');

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
      history: [] as Array<{
        groupId: string;
        blockId: string;
        blockType: string;
        input?: string;
        output?: string;
        timestamp: Date;
      }>,
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
          engine: 'ts',
        },
      },
    );
    await publishStatus(executionId, { status: 'success', finishedAt, durationMs });
    console.log(`[sabflow-worker] execution ${executionId} completed via TS engine in ${durationMs}ms`);
  } catch (err) {
    const errMsg = err instanceof Error ? err.message : String(err);
    console.error(`[sabflow-worker] execution ${executionId} failed (TS engine): ${errMsg}`);

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
          engine: 'ts',
        },
      },
    );
    await publishStatus(executionId, { status: 'error', finishedAt, durationMs, error: errMsg });
    throw err;
  }
}

// ── Processor ──────────────────────────────────────────────────────────────

async function processExecution(job: Job<ExecutionJobPayload>): Promise<void> {
  const { executionId, flowId } = job.data;

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

  // ── Primary path: delegate to the Rust engine ───────────────────────────
  try {
    const result = await rustExecuteFlow(job.data);

    const durationMs = Date.now() - start;
    const finishedAt = new Date();

    // Persist node steps in the `ExecutionHistoryNode` shape the replay UI
    // and /api/sabflow/logs read, alongside the raw engine records.
    const nodes = (result.node_results ?? []).map((n) => ({
      blockId: n.block_id,
      blockType: n.block_type,
      status: n.status,
      ...(n.error ? { error: n.error } : {}),
    }));

    if (result.status === 'success') {
      await execCol.updateOne(
        { executionId },
        {
          $set: {
            status: 'success',
            finishedAt,
            durationMs,
            updatedVariables: result.variables ?? {},
            nodeResults: result.node_results ?? [],
            nodes,
            engine: 'rust',
          },
        },
      );
      await publishStatus(executionId, { status: 'success', finishedAt, durationMs });
      console.log(`[sabflow-worker] execution ${executionId} completed via Rust engine in ${durationMs}ms`);
      return;
    }

    // Engine returned an explicit error — record it, but DO NOT fall back
    // (the flow was actually executed; the error is from inside the run).
    const errMsg = result.error ?? 'Rust engine reported an error';
    await execCol.updateOne(
      { executionId },
      {
        $set: {
          status: 'error',
          finishedAt,
          durationMs,
          error: errMsg,
          nodeResults: result.node_results ?? [],
          nodes,
          engine: 'rust',
        },
      },
    );
    await publishStatus(executionId, { status: 'error', finishedAt, durationMs, error: errMsg });
    throw new Error(errMsg);
  } catch (rustErr) {
    // Only fall back when Rust is unreachable. Functional errors from a
    // successful HTTP exchange have already been handled above.
    if (!isConnectionError(rustErr)) {
      const errMsg = rustErr instanceof Error ? rustErr.message : String(rustErr);
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
            engine: 'rust',
          },
        },
      );
      await publishStatus(executionId, { status: 'error', finishedAt, durationMs, error: errMsg });
      throw rustErr;
    }

    console.warn(
      '[sabflow-worker] Rust engine unreachable, falling back to TS engine:',
      rustErr instanceof Error ? rustErr.message : rustErr,
    );
    await runWithTsEngine(job.data);
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
