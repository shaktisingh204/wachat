/**
 * SabFlow WS gateway — per-document seat-limit enforcement.
 *
 * Implements the per-doc concurrent-editor cap defined in
 * `docs/adr/sabflow-seat-model.md` (§3.2 ladder) and the WS-upgrade-time
 * enforcement contract in `docs/adr/sabflow-ws-gateway-node.md` §6.
 *
 * The seat budget is the SabFlow real-time-collab safety primitive: one
 * "seat" = one live write-capable WebSocket connection on one doc, keyed
 * by `(workspaceId, docId, userId)`. The 5-tier ceiling table is:
 *
 *   free       → 1   (solo only)
 *   starter    → 3
 *   pro        → 5
 *   business   → 10
 *   enterprise → unlimited (Infinity)
 *
 * On WS upgrade the gateway calls `tryClaimSeat`. If the doc is already at
 * capacity for the caller's plan, `{ ok: false, reason: 'SEAT_LIMIT' }` is
 * returned and `services/sabflow-ws/src/connection.ts` (sibling, sub-task
 * #4) closes the socket with WS close code 4403 + JSON payload
 * `{ "code": "SEAT_LIMIT", "tier": <planId>, "limit": <N>, "docId": <id> }`.
 *
 * Atomicity: the read-cap-then-INCR is one Redis round-trip via a Lua
 * script — two concurrent claims racing on the N-th seat cannot both
 * succeed.
 *
 * Idempotency: a returning user (same `userId` on the same `docId`) is
 * allowed without re-counting. The per-user key carries a 90 s TTL — one
 * heartbeat window per the ADR; missed heartbeats expire the seat so a
 * crashed gateway cannot strand it.
 *
 * Scope of this sub-task (Track A · Phase 3 · #7 of 10):
 * - `tryClaimSeat({ workspaceId, docId, userId, plan }): atomic claim`.
 * - `releaseSeat({ workspaceId, docId, userId }): release on close`.
 * - `heartbeatSeat({ workspaceId, docId, userId }): refresh TTL on ping`.
 * - Plan → numeric cap resolution mirroring the ADR table.
 *
 * Out of scope (other sub-tasks):
 * - Redis client construction — siblings/Phase 7 provide the real client.
 * - `resolvePlan(workspaceId)` — forward-declared here; Phase 8 wires to
 *   `src/lib/billing/entitlements.ts`.
 * - WS close-code emission + JSON payload framing — sub-task #4
 *   (connection.ts) consumes our `{ ok: false, ... }` and converts.
 * - Viewer cap, share-link guest accounting — ADR §3.2, deferred.
 * - Multi-instance drift reconciliation — Phase 9 Vercel Cron job.
 */

// ---------------------------------------------------------------------------
// Forward-declared types (kept inline; siblings will satisfy them).
// ---------------------------------------------------------------------------

/**
 * Minimal Redis client surface this module needs. The real client (likely
 * `ioredis`) is injected via `setRedisClient` by the service bootstrap
 * (sibling sub-task) so this file has no transitive dependency on a
 * specific Redis driver and stays unit-testable with a stub.
 *
 * The `eval` shape mirrors `ioredis.eval(script, numKeys, ...args)` which
 * returns `Promise<unknown>` — we narrow at the call site.
 */
export interface RedisLike {
  set(
    key: string,
    value: string,
    mode: 'EX',
    ttlSeconds: number,
  ): Promise<unknown>;
  expire(key: string, ttlSeconds: number): Promise<number>;
  del(key: string): Promise<number>;
  eval(
    script: string,
    numKeys: number,
    ...args: (string | number)[]
  ): Promise<unknown>;
}

/**
 * Plan-tier descriptor as the gateway sees it on upgrade. The `tier` field
 * must be one of the canonical SabNode plan ids — see
 * `src/lib/billing/entitlements.ts` `PLAN_TABLE`.
 */
export type PlanTier =
  | 'free'
  | 'starter'
  | 'pro'
  | 'business'
  | 'enterprise';

export interface PlanDescriptor {
  tier: PlanTier | string;
}

/**
 * Forward declaration — Phase 8 will wire this to
 * `src/lib/billing/entitlements.ts` (see ADR §2.4 `canUse` /
 * `entitlementsFor`). Until then, callers may inject any implementation
 * (e.g. the connection handler may have already resolved the plan from
 * the JWT claim and pass it directly, bypassing this lookup).
 *
 * Default implementation returns `free` — the safe, most-restrictive
 * tier — so an unwired environment cannot accidentally grant unbounded
 * seats.
 */
let _resolvePlan: (workspaceId: string) => Promise<PlanDescriptor> = async (
  _workspaceId: string,
) => ({ tier: 'free' });

/**
 * Service bootstrap calls this once at startup to wire the real plan
 * resolver. Re-exported for tests.
 */
export function setPlanResolver(
  fn: (workspaceId: string) => Promise<PlanDescriptor>,
): void {
  _resolvePlan = fn;
}

export function resolvePlan(workspaceId: string): Promise<PlanDescriptor> {
  return _resolvePlan(workspaceId);
}

// ---------------------------------------------------------------------------
// Redis client injection
// ---------------------------------------------------------------------------

let _redis: RedisLike | null = null;

/**
 * Inject the Redis client. Called once by the service bootstrap before
 * the WS listener accepts any upgrades.
 */
export function setRedisClient(client: RedisLike): void {
  _redis = client;
}

function getRedis(): RedisLike {
  if (_redis === null) {
    throw new Error(
      'sabflow-ws/seats: Redis client not injected — call setRedisClient() at bootstrap',
    );
  }
  return _redis;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/**
 * Per-tier concurrent-editor ceilings. Mirrors
 * `docs/adr/sabflow-seat-model.md` §3.2. `Infinity` encodes "unlimited" —
 * the cap-check in `claimLua` (below) treats any non-finite cap as a
 * no-op and always allows the claim.
 */
export const SEAT_CAP_BY_TIER: Readonly<Record<string, number>> = Object.freeze(
  {
    free: 1,
    starter: 3,
    pro: 5,
    business: 10,
    enterprise: Number.POSITIVE_INFINITY,
  },
);

/**
 * Heartbeat window per ADR §3.5 (30 s ping + 10 s pong tolerance, 2-miss
 * tolerance ≈ 70 s). Rounded up to 90 s so a single missed heartbeat
 * does not evict an active seat.
 */
export const SEAT_TTL_SECONDS = 90;

/** WS close code emitted by the connection layer on `SEAT_LIMIT`. */
export const SEAT_LIMIT_CLOSE_CODE = 4403;

/** Redis key prefixes. Kept private — callers should never construct keys directly. */
const COUNT_KEY_PREFIX = 'sabflow:collab:';
const SEAT_KEY_PREFIX = 'sabflow:seat:';

function countKey(docId: string): string {
  return `${COUNT_KEY_PREFIX}${docId}:editors`;
}

function userSeatKey(docId: string, userId: string): string {
  return `${SEAT_KEY_PREFIX}${docId}:${userId}`;
}

// ---------------------------------------------------------------------------
// Plan → cap resolution
// ---------------------------------------------------------------------------

/**
 * Resolve the per-doc editor cap for a plan tier. Unknown tiers fall back
 * to the most-restrictive (`free` = 1) so a typo in a plan id cannot grant
 * unbounded seats.
 */
export function capForTier(tier: string): number {
  const cap = SEAT_CAP_BY_TIER[tier];
  if (typeof cap === 'number') return cap;
  return SEAT_CAP_BY_TIER.free;
}

// ---------------------------------------------------------------------------
// Lua: atomic claim
// ---------------------------------------------------------------------------

/**
 * Atomic claim script.
 *
 * KEYS[1] = `sabflow:collab:<docId>:editors`         (counter)
 * KEYS[2] = `sabflow:seat:<docId>:<userId>`          (per-user idempotency key)
 *
 * ARGV[1] = cap (integer; -1 means unlimited)
 * ARGV[2] = ttl seconds
 * ARGV[3] = "1" (value to SET on the per-user key)
 *
 * Returns: { allowed (0|1), count (current editor count after script) }
 *
 * Semantics:
 *   - If the per-user key already exists → idempotent re-claim: refresh
 *     its TTL, do NOT INCR the counter, return allowed=1.
 *   - Else read the counter, and:
 *       - If cap == -1 (unlimited) OR counter < cap → INCR, SET per-user
 *         key with TTL, return allowed=1.
 *       - Else → return allowed=0 (the counter is left untouched).
 */
const CLAIM_LUA = `
local count_key = KEYS[1]
local user_key  = KEYS[2]
local cap       = tonumber(ARGV[1])
local ttl       = tonumber(ARGV[2])
local marker    = ARGV[3]

if redis.call('EXISTS', user_key) == 1 then
  redis.call('EXPIRE', user_key, ttl)
  local cur = tonumber(redis.call('GET', count_key) or '0')
  return { 1, cur }
end

local cur = tonumber(redis.call('GET', count_key) or '0')
if cap ~= -1 and cur >= cap then
  return { 0, cur }
end

local new_count = redis.call('INCR', count_key)
redis.call('SET', user_key, marker, 'EX', ttl)
return { 1, new_count }
`.trim();

/**
 * Lua: paired release. DEL the per-user key; DECR the counter only if
 * the per-user key existed (so a stray release call cannot drive the
 * counter negative). Counter is floored at 0 defensively.
 *
 * KEYS[1] = counter key
 * KEYS[2] = per-user key
 *
 * Returns: new counter value (or 0 if the user had no seat).
 */
const RELEASE_LUA = `
local count_key = KEYS[1]
local user_key  = KEYS[2]

if redis.call('DEL', user_key) == 0 then
  return tonumber(redis.call('GET', count_key) or '0')
end

local cur = tonumber(redis.call('GET', count_key) or '0')
if cur <= 1 then
  redis.call('DEL', count_key)
  return 0
end
return redis.call('DECR', count_key)
`.trim();

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export interface SeatClaimArgs {
  workspaceId: string;
  docId: string;
  userId: string;
  /**
   * Caller-resolved plan descriptor. If omitted, `resolvePlan(workspaceId)`
   * is awaited — see forward-decl above.
   */
  plan?: PlanDescriptor;
}

export type SeatClaimResult =
  | { ok: true }
  | {
      ok: false;
      reason: 'SEAT_LIMIT';
      limit: number;
      tier: string;
    };

/**
 * Attempt to claim one editor seat on `(workspaceId, docId)` for `userId`.
 *
 * - Returns `{ ok: true }` if the seat was granted (either freshly INCR'd
 *   or refreshed for an existing claim by the same user).
 * - Returns `{ ok: false, reason: 'SEAT_LIMIT', limit, tier }` if the doc
 *   is at capacity for the caller's plan. The connection layer should
 *   close the WS with code 4403 and serialise `{ code: 'SEAT_LIMIT', tier,
 *   limit, docId }` as the body (ADR §4.2).
 *
 * The check is atomic via Lua; two concurrent upgrades racing on the
 * N-th seat cannot both succeed.
 */
export async function tryClaimSeat(
  args: SeatClaimArgs,
): Promise<SeatClaimResult> {
  const { workspaceId, docId, userId } = args;
  const plan = args.plan ?? (await resolvePlan(workspaceId));
  const tier = String(plan.tier);
  const cap = capForTier(tier);
  // Encode unlimited as -1 for the Lua script (Redis Lua has no Infinity).
  const capArg = Number.isFinite(cap) ? cap : -1;

  const redis = getRedis();
  const raw = await redis.eval(
    CLAIM_LUA,
    2,
    countKey(docId),
    userSeatKey(docId, userId),
    capArg,
    SEAT_TTL_SECONDS,
    '1',
  );

  const result = normaliseClaimResult(raw);

  if (result.allowed === 1) {
    return { ok: true };
  }
  return {
    ok: false,
    reason: 'SEAT_LIMIT',
    limit: cap,
    tier,
  };
}

export interface SeatReleaseArgs {
  workspaceId: string;
  docId: string;
  userId: string;
}

/**
 * Release one seat. Called from `connection.ts` on socket close (any
 * reason — normal close, idle timeout, server-side kick).
 *
 * Safe to call multiple times: if the per-user key is already gone, the
 * counter is left untouched.
 */
export async function releaseSeat(args: SeatReleaseArgs): Promise<void> {
  const { docId, userId } = args;
  const redis = getRedis();
  await redis.eval(
    RELEASE_LUA,
    2,
    countKey(docId),
    userSeatKey(docId, userId),
  );
}

/**
 * Refresh the per-user seat TTL. Called from `connection.ts` on every
 * pong (or every successful heartbeat tick). The counter key itself has
 * no TTL — its lifetime is driven by INCR/DECR — but a per-user key
 * that ages out releases the seat without an explicit DECR (Redis
 * EXPIRE handles it).
 *
 * Caller is expected to invoke this once per heartbeat window; if a
 * client misses two heartbeats (≈70 s), the 90 s TTL still has 20 s of
 * grace before the seat evaporates.
 */
export async function heartbeatSeat(args: SeatReleaseArgs): Promise<void> {
  const { docId, userId } = args;
  const redis = getRedis();
  await redis.expire(userSeatKey(docId, userId), SEAT_TTL_SECONDS);
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Coerce the polymorphic Redis-eval reply into `{ allowed, count }`.
 *
 * `ioredis` returns Lua array replies as JS arrays of numbers/strings;
 * other drivers may return strings. We accept both.
 */
function normaliseClaimResult(
  raw: unknown,
): { allowed: 0 | 1; count: number } {
  if (Array.isArray(raw) && raw.length >= 2) {
    const allowed = toInt(raw[0]) === 1 ? 1 : 0;
    const count = toInt(raw[1]);
    return { allowed, count };
  }
  // Unexpected shape — fail closed.
  return { allowed: 0, count: 0 };
}

function toInt(v: unknown): number {
  if (typeof v === 'number') return Math.trunc(v);
  if (typeof v === 'string') {
    const n = Number.parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  }
  if (typeof v === 'bigint') return Number(v);
  return 0;
}
