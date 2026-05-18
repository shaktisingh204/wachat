/**
 * SabFlow queue rate-limit — per-workspace + per-plan throttle.
 *
 * Track B Phase 2 / sub-task #7: protect the SabFlow execution queue from
 * runaway tenants by capping `workflow_executions/minute` at enqueue time.
 * The Rust dispatcher (`rust/crates/sabflow-executor/queue/src/rate_limit.rs`)
 * runs the same check at claim time against the same Redis keys, so a burst
 * that slips past the API boundary is still refused before a worker picks
 * it up.
 *
 * ## Algorithm
 *
 * Fixed-bucket-per-minute sliding window:
 *
 *   - Key: `sabflow:rate:<plan>:<workspaceId>:<minute>` where `<minute>` is
 *     `Math.floor(Date.now() / 60_000)`.
 *   - On each check: INCR the key, then EXPIRE 65s so old buckets evict
 *     themselves. (65s = 60s window + 5s slack so a check that lands
 *     exactly on a minute boundary still sees a fresh TTL.)
 *   - If the post-INCR value exceeds the plan cap, the call is denied and
 *     we decrement back so the counter reflects accepted work only.
 *
 * The "sliding window counter" name is a slight misnomer — we use a fixed
 * bucket per wall-clock minute, which is the standard cheap approximation.
 * A request right at the minute boundary could in theory burst at 2×cap;
 * the dispatcher-side check is the safety net for that edge.
 *
 * ## Plan caps (`workflow_executions/minute`)
 *
 *   free       → 5
 *   starter    → 30
 *   pro        → 120
 *   business   → 600
 *   enterprise → unlimited (no Redis round-trip; we short-circuit)
 *
 * ## Usage-meter integration
 *
 * When a request is allowed, we forward to the billing meter via
 * `recordUsage('workflow_executions', workspaceId, 1)`. This records queue
 * submission, not successful runs. The meter's own idempotency-key support
 * is the right place to decide whether failed runs should be refunded; we
 * intentionally don't gate the meter call on success here.
 */

import 'server-only';
import { recordUsage } from '@/lib/billing/usage-meter';

// ── Plan caps ─────────────────────────────────────────────────────────

/** Plan IDs recognised by this limiter. Extra plans fall through to `free`. */
export type PlanId = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

/** `Infinity` means "unlimited — skip the Redis check entirely". */
const PLAN_CAPS_PER_MINUTE: Record<PlanId, number> = {
    free: 5,
    starter: 30,
    pro: 120,
    business: 600,
    enterprise: Infinity,
};

/** Bucket TTL: 60s window + 5s slack. */
const BUCKET_TTL_SEC = 65;

// ── Public surface ────────────────────────────────────────────────────

export interface EnqueueRateCheckInput {
    workspaceId: string;
    plan: PlanId | string;
}

export interface EnqueueRateCheckResult {
    /** True when the caller may proceed to enqueue. */
    allowed: boolean;
    /** Tokens left in the current minute window after this check. */
    remaining: number;
    /** Seconds the caller should wait before retrying. Always >= 1 on deny. */
    retryAfterSec: number;
}

/**
 * Check (and atomically reserve) one slot in the per-workspace+plan minute
 * bucket. When `allowed === true` we also record one
 * `workflow_executions` usage event so the billing meter reflects queue
 * submission.
 *
 * Failure modes:
 *   - Unknown plan id → treated as `free` (the strictest cap).
 *   - Redis unavailable → fail-open (allow + log warning); the dispatcher's
 *     claim-side check is the secondary line of defense. Throttling is a
 *     guard rail, not a correctness invariant, so a degraded Redis must not
 *     make the platform unusable.
 */
export async function checkEnqueueRate(
    input: EnqueueRateCheckInput,
): Promise<EnqueueRateCheckResult> {
    if (!input.workspaceId) {
        throw new Error('workspaceId required');
    }

    const plan = normalisePlan(input.plan);
    const cap = PLAN_CAPS_PER_MINUTE[plan];

    // Unlimited plans skip both the Redis hit and the meter write — the
    // latter is recorded by the caller after the job lands in the queue
    // (idempotency-keyed on the executionId). Surfacing `remaining` as
    // `Number.MAX_SAFE_INTEGER` is a deliberate signal to UI code that
    // "don't bother showing a quota indicator".
    if (!Number.isFinite(cap)) {
        return { allowed: true, remaining: Number.MAX_SAFE_INTEGER, retryAfterSec: 0 };
    }

    const minute = Math.floor(Date.now() / 60_000);
    const key = bucketKey(plan, input.workspaceId, minute);

    let client: RedisLike | null = null;
    try {
        client = await getRedis();
    } catch (err) {
        // Fail-open. The dispatcher will still re-check at claim time and
        // operators get a `redis_unavailable` warning in the logs.
        // eslint-disable-next-line no-console
        console.warn('[sabflow.rate-limit] redis unavailable, failing open', err);
        await recordUsage({
            tenantId: input.workspaceId,
            feature: 'workflow_executions',
            units: 1,
        }).catch(() => undefined);
        return { allowed: true, remaining: cap, retryAfterSec: 0 };
    }

    const count = await client.incr(key);
    if (count === 1) {
        // First hit in this minute — set TTL. We always re-EXPIRE on the
        // first INCR rather than every call to keep the round-trip small.
        await client.expire(key, BUCKET_TTL_SEC);
    }

    if (count > cap) {
        // Roll back so the counter only reflects accepted work. A best-effort
        // DECR is fine here — if it fails we'll just over-count for one
        // minute and the bucket evicts itself.
        await client.decr(key).catch(() => undefined);
        const retryAfterSec = secondsUntilNextMinute();
        return { allowed: false, remaining: 0, retryAfterSec };
    }

    // Allowed — write the meter event before returning. We don't await the
    // meter write blocking the queue submission would be silly; the meter
    // is append-only and tolerant of duplicates via its idempotency key.
    void recordUsage({
        tenantId: input.workspaceId,
        feature: 'workflow_executions',
        units: 1,
    }).catch((err) => {
        // eslint-disable-next-line no-console
        console.warn('[sabflow.rate-limit] usage-meter write failed', err);
    });

    return {
        allowed: true,
        remaining: Math.max(0, cap - count),
        retryAfterSec: 0,
    };
}

// ── Internals ─────────────────────────────────────────────────────────

/**
 * Coerce an arbitrary plan string to a known PlanId. Unknown values fall
 * to `free` — the strictest cap — so a misconfigured tenant can never
 * accidentally unlock a higher rate by sending garbage.
 */
function normalisePlan(plan: string): PlanId {
    if (plan in PLAN_CAPS_PER_MINUTE) {
        return plan as PlanId;
    }
    return 'free';
}

/**
 * Produce the Redis key for a bucket. Exported via `_internals` for the
 * dispatcher-side and tests; not part of the stable public surface.
 */
function bucketKey(plan: PlanId, workspaceId: string, minute: number): string {
    return `sabflow:rate:${plan}:${workspaceId}:${minute}`;
}

function secondsUntilNextMinute(): number {
    const remainderMs = 60_000 - (Date.now() % 60_000);
    return Math.max(1, Math.ceil(remainderMs / 1000));
}

/** Minimal shape we need from the Redis client. */
interface RedisLike {
    incr(key: string): Promise<number>;
    decr(key: string): Promise<number>;
    expire(key: string, seconds: number): Promise<unknown>;
}

/**
 * Lazy ioredis client — matches the convention in
 * `src/lib/sabflow/recipes/durable.ts`. We keep the singleton on
 * `globalThis` so HMR / multiple imports don't open extra connections.
 */
declare global {
    // eslint-disable-next-line no-var
    var __sabflowRateLimitRedis: RedisLike | undefined;
}

async function getRedis(): Promise<RedisLike> {
    if (globalThis.__sabflowRateLimitRedis) return globalThis.__sabflowRateLimitRedis;
    const { default: IORedis } = await import('ioredis');
    const url = process.env.REDIS_URL || 'redis://localhost:6379';
    const client = new IORedis(url, {
        maxRetriesPerRequest: 2,
        enableReadyCheck: true,
        lazyConnect: false,
    }) as unknown as RedisLike;
    globalThis.__sabflowRateLimitRedis = client;
    return client;
}

/** Test/maintenance hooks. Not part of the stable public surface. */
export const _internals = {
    bucketKey,
    secondsUntilNextMinute,
    PLAN_CAPS_PER_MINUTE,
    BUCKET_TTL_SEC,
};
