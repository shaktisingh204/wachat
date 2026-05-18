/**
 * SabFlow — Node-side queue enqueue API.
 *
 * Producer half of the SabFlow executor's queue-mode topology (see
 * `docs/adr/sabflow-executor-n8n-survey.md` §3.2 / §4 / §7, and PLAN
 * Track B Phase 2 sub-task #2 of 10). Consumers (the Rust dispatcher
 * worker loop, sibling #3) and the queue-schema constants (sibling #1)
 * live in separate modules; we forward-declare what we need from them
 * to avoid a hard import cycle while those modules are still in flight.
 *
 * Surface area exposed to the rest of SabNode:
 *
 *   - `enqueueExecution`       — push a workflow execution onto `sabflow:executions`.
 *   - `enqueueWebhookDelivery` — push an after-the-fact `Respond to Webhook`
 *                                  delivery onto `sabflow:webhooks`.
 *   - `enqueueCronFire`        — push a scheduled fire onto `sabflow:cron`
 *                                  (called by the Vercel Cron handler).
 *   - `cancelJob`              — cooperative cancellation flag on the hash;
 *                                  the worker (sibling #9) honours it.
 *
 * Atomicity model: each enqueue runs through a single Redis `MULTI/EXEC`
 * pipeline that performs `INCR id` → `HSET hash` → `LPUSH wait` (or
 * `ZADD delayed` when `delayMs > 0`). The `LPUSH` direction mirrors
 * BullMQ semantics so existing tooling (`bull-board`, `bullmq`
 * inspectors) can read the queue (see survey §4 first bullet, and Phase
 * 2 sub-task #1's "Bull-compat schema" requirement).
 *
 * Idempotency: callers MAY pass `idempotencyKey`. We `SET NX EX 86400`
 * a tombstone holding the freshly-minted job id; on conflict we read
 * the tombstone back and return the existing job id without touching
 * the queue. Webhook retries from upstream providers (Stripe, Meta,
 * etc.) are the primary use case.
 *
 * Ownership: this file is the ONLY owner of the enqueue API. It does
 * not own the schema (sibling #1), the worker (sibling #3), the
 * priority/concurrency policy (sibling #4), the retry policy (sibling
 * #5), the DLQ (sibling #6), nor the rate limiter (sibling #7).
 *
 * Track B · Phase 2 · sub-task #2 of 10.
 */

// `redis` is exported via CommonJS `module.exports` in `src/lib/redis.ts`,
// so we `require()` it to dodge the default-vs-namespace import dance.
// Matches the pattern already used by `sabflow/persistence/compaction.ts`.
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getRedisClient } = require('@/lib/redis') as {
    getRedisClient: () => Promise<RedisLikeClient>;
};

// -----------------------------------------------------------------------------
// Forward declarations — sibling #1 (queue schema) owns the real exports.
// -----------------------------------------------------------------------------

/**
 * Bull-compatible queue names. Sibling #1 will publish the canonical
 * constants module; the names below are the contract.
 *
 * - `sabflow:executions` — workflow runs (trigger / manual / retry / webhook
 *   / subworkflow modes; survey §3.2 + §11).
 * - `sabflow:webhooks`   — async `Respond to Webhook` deliveries (survey
 *   §7 step 4c).
 * - `sabflow:cron`       — Vercel Cron fires (survey §11 "Cron triggers").
 */
export type QueueName =
    | 'sabflow:executions'
    | 'sabflow:webhooks'
    | 'sabflow:cron';

/**
 * Key namer for a given queue. Sibling #1 will export the production
 * implementation; this interface is the seam.
 *
 * BullMQ-compatible layout (see survey §4):
 *   - `id`      — `INCR`-able counter that mints job ids.
 *   - `hash(id)`— `HSET` target; holds the full job payload + status.
 *   - `wait`    — list of ready job ids (`LPUSH` to insert, worker
 *                  `BRPOPLPUSH`-s into `active`).
 *   - `delayed` — sorted set keyed by `executeAt` epoch ms.
 *   - `cancel(id)` — tombstone read by the worker each tick.
 *   - `idem(idempotencyKey)` — `SET NX` tombstone for de-dup.
 */
export interface QueueKeys {
    id(queue: QueueName): string;
    hash(queue: QueueName, jobId: string): string;
    wait(queue: QueueName): string;
    delayed(queue: QueueName): string;
    cancel(queue: QueueName, jobId: string): string;
    idem(queue: QueueName, idempotencyKey: string): string;
}

/**
 * Field names for the job hash. Sibling #1 owns the full schema;
 * the producer only writes the small subset enumerated here.
 *
 * `data` is the JSON-serialised payload (so the hash stays
 * inspector-readable from `bull-board`).
 */
export interface JobHashFields {
    /** JSON-serialised payload (the `triggerData` / target / etc.). */
    data: 'data';
    /** Initial status — always `'waiting'` from the producer. */
    status: 'status';
    /** Wall-clock epoch ms the job was created. */
    createdAt: 'createdAt';
    /** Epoch ms the job becomes runnable (set when `delayMs > 0`). */
    executeAt: 'executeAt';
    /** Tenant scope, indexed for per-workspace rate-limit + concurrency. */
    workspaceId: 'workspaceId';
    /** Producer-supplied mode; consumer routes on this. */
    mode: 'mode';
    /** Bull-compat priority (lower number = higher priority). */
    priority: 'priority';
    /** Plan tier — sibling #4 reads this for per-plan concurrency caps. */
    plan: 'plan';
    /** Optional parent execution id (sub-workflow nesting). */
    parentExecutionId: 'parentExecutionId';
    /** Optional idempotency key, for log/audit. */
    idempotencyKey: 'idempotencyKey';
}

/**
 * Default key namer. Mirrors BullMQ's `bull:<queue>:<suffix>` layout
 * so existing tooling (`bull-board` etc.) recognises the keys. Sibling
 * #1 may override this; we use it as the fallback so this file is
 * usable in isolation (tests, scripts).
 */
const DEFAULT_KEYS: QueueKeys = {
    id: (q) => `bull:${q}:id`,
    hash: (q, id) => `bull:${q}:${id}`,
    wait: (q) => `bull:${q}:wait`,
    delayed: (q) => `bull:${q}:delayed`,
    cancel: (q, id) => `bull:${q}:${id}:cancel`,
    idem: (q, key) => `bull:${q}:idem:${key}`,
};

/** Default hash-field names, matching BullMQ keys 1-for-1. */
const DEFAULT_FIELDS: JobHashFields = {
    data: 'data',
    status: 'status',
    createdAt: 'createdAt',
    executeAt: 'executeAt',
    workspaceId: 'workspaceId',
    mode: 'mode',
    priority: 'priority',
    plan: 'plan',
    parentExecutionId: 'parentExecutionId',
    idempotencyKey: 'idempotencyKey',
};

// -----------------------------------------------------------------------------
// Minimal Redis surface we depend on. Matches `node-redis@4` (already used
// by `src/lib/redis.ts` and `sabflow/persistence/compaction.ts`).
// -----------------------------------------------------------------------------

/** One slot of a `MULTI` pipeline. The real client returns chainable. */
interface RedisMulti {
    incr(key: string): RedisMulti;
    hSet(key: string, fields: Record<string, string>): RedisMulti;
    lPush(key: string, value: string): RedisMulti;
    zAdd(key: string, member: { score: number; value: string }): RedisMulti;
    exec(): Promise<Array<unknown>>;
}

export interface RedisLikeClient {
    incr(key: string): Promise<number>;
    multi(): RedisMulti;
    set(
        key: string,
        value: string,
        opts: { NX: true; EX: number },
    ): Promise<string | null>;
    /** Unconditional SET with TTL — used to publish the final id over our own idempotency placeholder. */
    set(
        key: string,
        value: string,
        opts: { EX: number },
    ): Promise<string | null>;
    get(key: string): Promise<string | null>;
    del(key: string): Promise<number>;
}

// -----------------------------------------------------------------------------
// Public API
// -----------------------------------------------------------------------------

/** Plan tier — passed through so sibling #4 can apply per-plan caps. */
export type PlanTier = string;

/** Execution mode mirrors n8n's `execution_entity.mode` (survey §10). */
export type ExecutionMode =
    | 'trigger'
    | 'manual'
    | 'retry'
    | 'webhook'
    | 'subworkflow';

/** Args for {@link enqueueExecution}. */
export interface EnqueueExecutionInput {
    workspaceId: string;
    workflowId: string;
    mode: ExecutionMode;
    /** Whatever the trigger node hands the workflow as its first item. */
    triggerData: unknown;
    /** BullMQ priority — lower = higher; default 0. */
    priority?: number;
    /** Schedule the job in the future; 0/undefined = ready immediately. */
    delayMs?: number;
    /** Parent execution id when this run is a sub-workflow. */
    parentExecutionId?: string;
    /** Plan tier; sibling #4 enforces per-plan concurrency caps. */
    plan: PlanTier;
    /**
     * Optional idempotency key. If a job with the same key landed in the
     * last 24h, we return that job's id without enqueuing a duplicate.
     */
    idempotencyKey?: string;
}

/** Args for {@link enqueueWebhookDelivery}. */
export interface EnqueueWebhookDeliveryInput {
    workspaceId: string;
    /** The execution that produced the response (survey §7 step 4c). */
    executionId: string;
    /** Outbound target — URL + method + headers. Opaque to this module. */
    target: unknown;
    payload: unknown;
    priority?: number;
    delayMs?: number;
    idempotencyKey?: string;
}

/** Args for {@link enqueueCronFire}. */
export interface EnqueueCronFireInput {
    workspaceId: string;
    workflowId: string;
    /** ISO timestamp the cron was supposed to fire at. */
    scheduledFor: string;
    priority?: number;
    /** Cron usually de-dupes by `(workflowId, scheduledFor)`. */
    idempotencyKey?: string;
}

/**
 * Enqueue a workflow execution onto `sabflow:executions`.
 *
 * @example
 * ```ts
 * import { enqueueExecution } from '@/lib/sabflow/queue/enqueue';
 *
 * const { jobId } = await enqueueExecution({
 *   workspaceId: 'ws_123',
 *   workflowId: 'wf_456',
 *   mode: 'webhook',
 *   triggerData: { headers, body },
 *   plan: 'pro',
 *   idempotencyKey: `stripe:${event.id}`,
 * });
 * ```
 */
export async function enqueueExecution(
    input: EnqueueExecutionInput,
): Promise<{ jobId: string }> {
    const {
        workspaceId,
        workflowId,
        mode,
        triggerData,
        priority = 0,
        delayMs = 0,
        parentExecutionId,
        plan,
        idempotencyKey,
    } = input;

    return enqueue({
        queue: 'sabflow:executions',
        priority,
        delayMs,
        idempotencyKey,
        hashFields: {
            workspaceId,
            mode,
            plan,
            ...(parentExecutionId ? { parentExecutionId } : {}),
            data: JSON.stringify({ workflowId, triggerData }),
        },
    });
}

/**
 * Enqueue an after-the-fact `Respond to Webhook` delivery onto
 * `sabflow:webhooks`. The executor uses this when a node downstream of
 * the original webhook request needs to fire the response asynchronously
 * (survey §7 step 4c).
 *
 * @example
 * ```ts
 * await enqueueWebhookDelivery({
 *   workspaceId: 'ws_123',
 *   executionId: 'exec_789',
 *   target: { url: 'https://hook.example.com/cb', method: 'POST' },
 *   payload: { ok: true },
 * });
 * ```
 */
export async function enqueueWebhookDelivery(
    input: EnqueueWebhookDeliveryInput,
): Promise<{ jobId: string }> {
    const {
        workspaceId,
        executionId,
        target,
        payload,
        priority = 0,
        delayMs = 0,
        idempotencyKey,
    } = input;

    return enqueue({
        queue: 'sabflow:webhooks',
        priority,
        delayMs,
        idempotencyKey,
        hashFields: {
            workspaceId,
            data: JSON.stringify({ executionId, target, payload }),
        },
    });
}

/**
 * Enqueue a cron fire. Called by the Vercel Cron handler — never by user
 * code (per CLAUDE.md "Cron jobs use Vercel Cron").
 *
 * Caller MUST set `idempotencyKey` to `<workflowId>:<scheduledForIso>`
 * so an accidental double-fire from the cron scheduler is collapsed.
 *
 * @example
 * ```ts
 * // app/api/cron/sabflow/route.ts (Vercel Cron handler)
 * await enqueueCronFire({
 *   workspaceId,
 *   workflowId,
 *   scheduledFor: new Date().toISOString(),
 *   idempotencyKey: `${workflowId}:${scheduledForIso}`,
 * });
 * ```
 */
export async function enqueueCronFire(
    input: EnqueueCronFireInput,
): Promise<{ jobId: string }> {
    const {
        workspaceId,
        workflowId,
        scheduledFor,
        priority = 0,
        idempotencyKey,
    } = input;

    return enqueue({
        queue: 'sabflow:cron',
        priority,
        delayMs: 0,
        idempotencyKey,
        hashFields: {
            workspaceId,
            data: JSON.stringify({ workflowId, scheduledFor }),
        },
    });
}

/**
 * Cooperative cancellation. Writes a tombstone the worker is expected
 * to check on each loop tick. The worker-side honour lives in sibling
 * #9 (Job cancellation — cooperative + hard kill).
 *
 * Returns `true` when the cancel flag was newly written, `false` when
 * the job is unknown / already terminal / already flagged.
 *
 * @example
 * ```ts
 * const wasCancelled = await cancelJob('sabflow:executions', jobId);
 * ```
 */
export async function cancelJob(
    queue: QueueName,
    jobId: string,
): Promise<boolean> {
    const client = await getRedisClient();
    const key = DEFAULT_KEYS.cancel(queue, jobId);
    // 1h TTL — long enough for any in-flight job to notice; short enough
    // that the key doesn't outlive Redis memory we care about.
    const wrote = await client.set(key, '1', { NX: true, EX: 3600 });
    return wrote !== null;
}

// -----------------------------------------------------------------------------
// Internal — shared enqueue path. NOT exported.
// -----------------------------------------------------------------------------

interface InternalEnqueueArgs {
    queue: QueueName;
    priority: number;
    delayMs: number;
    idempotencyKey?: string;
    /**
     * Per-call hash fields. `data` is REQUIRED; the rest are
     * caller-specific. Producer-managed fields (`status`, `createdAt`,
     * `executeAt`, `priority`, `idempotencyKey`) are added here.
     */
    hashFields: Record<string, string> & { data: string };
}

/** SETNX an idempotency tombstone, then run an atomic MULTI/EXEC enqueue. */
async function enqueue(args: InternalEnqueueArgs): Promise<{ jobId: string }> {
    const { queue, priority, delayMs, idempotencyKey, hashFields } = args;
    const client = await getRedisClient();
    const F = DEFAULT_FIELDS;
    const K = DEFAULT_KEYS;

    // Step 1 — idempotency tombstone. Set a placeholder *before* we mint
    // an id, so a racing caller with the same key gets to read whichever
    // id the winner ends up writing back. The placeholder is overwritten
    // (via plain `set` further down) once we have the real id.
    if (idempotencyKey) {
        const idemKey = K.idem(queue, idempotencyKey);
        // 24h TTL per spec.
        const wrote = await client.set(idemKey, 'pending', {
            NX: true,
            EX: 86400,
        });
        if (wrote === null) {
            // Loser of the race. Wait for the winner to publish the real
            // id, or return the placeholder if they haven't yet.
            const existing = await client.get(idemKey);
            if (existing && existing !== 'pending') {
                return { jobId: existing };
            }
            // Winner is still enqueuing. Best-effort: short bounded
            // poll. Worst case we fall through to a duplicate enqueue,
            // which the worker can DLQ via the idempotency key carried
            // on the hash. (Sibling #6 owns the DLQ side.)
            for (let i = 0; i < 5; i++) {
                await new Promise((r) => setTimeout(r, 20));
                const v = await client.get(idemKey);
                if (v && v !== 'pending') {
                    return { jobId: v };
                }
            }
        }
    }

    // Step 2 — mint a job id. `INCR` is atomic; we don't need to run it
    // inside the MULTI because the id is the only producer-visible side
    // effect of this call.
    const numericId = await client.incr(K.id(queue));
    const jobId = String(numericId);

    const now = Date.now();
    const executeAt = delayMs > 0 ? now + delayMs : now;

    // Step 3 — atomic MULTI/EXEC: HSET the payload, then either LPUSH
    // onto `wait` (ready) or ZADD into `delayed` (future). LPUSH
    // matches BullMQ direction so workers BRPOPLPUSH off the tail.
    const hashKey = K.hash(queue, jobId);
    const fields: Record<string, string> = {
        ...hashFields,
        [F.status]: 'waiting',
        [F.createdAt]: String(now),
        [F.executeAt]: String(executeAt),
        [F.priority]: String(priority),
    };
    if (idempotencyKey) {
        fields[F.idempotencyKey] = idempotencyKey;
    }

    const tx = client.multi().hSet(hashKey, fields);
    if (delayMs > 0) {
        tx.zAdd(K.delayed(queue), { score: executeAt, value: jobId });
    } else {
        tx.lPush(K.wait(queue), jobId);
    }
    await tx.exec();

    // Step 4 — publish the real id back onto the idempotency tombstone
    // so racing callers (who saw `'pending'` and are polling) get the
    // real id. We hold the lease (we won the SETNX in step 1 and we
    // minted the id in step 2), so an unconditional `SET ... EX 86400`
    // is correct — it overwrites our own `'pending'` placeholder and
    // refreshes the 24h TTL.
    if (idempotencyKey) {
        await client.set(K.idem(queue, idempotencyKey), jobId, { EX: 86400 });
    }

    return { jobId };
}
