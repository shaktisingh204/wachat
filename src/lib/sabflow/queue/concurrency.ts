/**
 * SabFlow — Priority levels + per-workspace concurrency caps (Node side).
 *
 * Track B · Phase 2 · sub-task #4 of 10.
 *
 * This file owns **two** small, side-effect-free contracts that the Node
 * producer (sibling #2, `enqueue.ts`) and the Rust dispatcher (sibling #3)
 * both consume:
 *
 *   1. The **priority lattice** every job is enqueued with — four named
 *      tiers (`low` / `normal` / `high` / `critical`) mapped to numeric
 *      scores. Lower-score names are *higher priority* on the Bull-compat
 *      wire (Bull v4 convention: smaller `priority` = served first), but
 *      for delayed-job ZSET ordering we want *larger* scores to sort
 *      *later* — so a `critical` job nudged off the head of `delayed` for
 *      "+1 ms" still wins over a `low` job pushed at the same instant.
 *      The mapping below is the single source of truth for both axes; the
 *      ZSET dispatcher reads `priorityScore()` directly.
 *
 *   2. The **per-workspace concurrency cap**, mirroring the plan ladder in
 *      `docs/adr/sabflow-seat-model.md` §3.2 and the canonical
 *      `entitlements.ts` plan ids. The cap is the hard upper bound on
 *      simultaneously-claimed jobs for one workspace; the dispatcher (Rust
 *      sibling #3) holds a Redis-backed semaphore at
 *      `sabflow:queue:<name>:wsinflight:<workspaceId>` and atomically
 *      checks-and-increments via a Lua script before BRPOPLPUSH'ing.
 *
 * Why split priority + concurrency into one module: both are read on
 * every enqueue and every claim, both are parameterised by the job's
 * `plan` field, and both are *pure* (no I/O — Redis touches happen in
 * the dispatcher, not here). Co-locating them keeps the surface a single
 * import for callers.
 *
 * Why no Redis I/O here: the actual semaphore lives in Rust (sibling #3
 * uses a Lua script for atomicity). The Node side only needs to know
 * the cap to (a) reject impossible enqueues early — e.g. a `free` tenant
 * trying to push job #2 while #1 is in-flight — and (b) surface the cap
 * to the UI / API so users see a meaningful error before round-tripping
 * to the worker. `canEnqueueAt()` is that helper.
 *
 * Forward-decl: the plan resolver (a function that maps `workspaceId ->
 * plan tier`) is **not** wired here — Phase 8 §4 owns plan-gate. Callers
 * pass `plan` in directly. The Rust side's `cap_resolver: Box<dyn Fn>`
 * is the same forward-decl on the executor side: it stays a closure
 * the dispatcher owner constructs, so this module avoids a hard
 * dependency on the billing graph.
 *
 * File ownership: this file. Siblings #2 (enqueue.ts) and #3 (Rust
 * dispatcher) **import** from it; they must not re-declare any of these
 * constants. The Rust mirror lives at
 * `rust/crates/sabflow-executor/queue/src/concurrency.rs`.
 */

// ────────────────────────────────────────────────────────────────────────────
// Priority
// ────────────────────────────────────────────────────────────────────────────

/**
 * Named priority tiers attached to every job at enqueue time. Four tiers
 * is the right granularity: it's enough to distinguish operator-driven
 * urgency without exploding into a free-form integer (which producers
 * always misuse).
 *
 * Semantics:
 *
 *   - `low`       — best-effort. Bulk imports, large CSV broadcasts,
 *                   nightly digests. May be deferred if the queue is hot.
 *   - `normal`    — the default. Per-trigger executions, ad-hoc manual
 *                   runs. Producers that don't set a priority land here.
 *   - `high`      — time-sensitive. SLA-bound webhook responses, real-time
 *                   notifications.
 *   - `critical`  — system-level. Heartbeat / health-check executions,
 *                   billing-cycle close-out, GDPR-erasure runs.
 *
 * Choosing a tier above `normal` is a deliberate cost decision — `high`
 * and `critical` consume concurrency budget out of order, so spamming
 * `critical` to "go faster" defeats the model.
 */
export type Priority = 'low' | 'normal' | 'high' | 'critical';

/**
 * Default priority when the producer omits it. Matches Bull v4's behaviour
 * of using `0` as the default — we encode that as `'normal'` here and let
 * `priorityScore()` translate to the numeric wire value.
 */
export const DEFAULT_PRIORITY: Priority = 'normal';

/**
 * Numeric score per priority tier. Used for **two** independent purposes:
 *
 *   1. The delayed-job ZSET (`<ns>:delayed`): an entry's score is
 *      `runAtEpochMs * 1000 + priorityNudge`, where `priorityNudge` is
 *      `MAX_SCORE - priorityScore(p)`. That way a `critical` delayed job
 *      pushed at the same ms as a `low` job promotes first when the
 *      dispatcher polls due jobs.
 *
 *   2. The per-job `priority` hash field — written as a decimal string in
 *      Bull's expected position, so `bull-board` can sort the dashboard.
 *      Bull v4's convention is "smaller = higher priority", which is the
 *      opposite of our ZSET ordering — `priorityWire()` flips it.
 *
 * Numeric gaps (1 → 5 → 10 → 20) leave room for future "between"
 * tiers (e.g. `'urgent'` at 15) without renumbering callers' on-disk
 * data.
 */
export const PRIORITY_SCORES: Readonly<Record<Priority, number>> = Object.freeze({
    low: 1,
    normal: 5,
    high: 10,
    critical: 20,
});

/** Largest score in the lattice; used to invert `wire = MAX - score`. */
const MAX_PRIORITY_SCORE = 20;

/** Runtime guard for foreign input (e.g. API JSON). */
export function isPriority(value: unknown): value is Priority {
    return (
        value === 'low' ||
        value === 'normal' ||
        value === 'high' ||
        value === 'critical'
    );
}

/**
 * Numeric score for a priority. Larger = more urgent. Use this for
 * **ZSET ordering** (delayed-job mover, dispatcher tie-break).
 */
export function priorityScore(p: Priority): number {
    return PRIORITY_SCORES[p];
}

/**
 * Bull v4-compatible **wire** priority — smaller = higher priority. Use
 * this when writing the job-hash `priority` field so `bull-board` and
 * any other Bull v4 inspector sort the dashboard correctly.
 *
 * Formula: `MAX_PRIORITY_SCORE - priorityScore(p)`. So `critical = 0`
 * (top of the dashboard) and `low = 19` (bottom).
 */
export function priorityWire(p: Priority): number {
    return MAX_PRIORITY_SCORE - PRIORITY_SCORES[p];
}

/**
 * Tolerant coercion for producer input. Accepts the four named tiers
 * directly; everything else (including `undefined`, `null`, unknown
 * strings) collapses to {@link DEFAULT_PRIORITY}. Numeric Bull-style
 * priorities are intentionally rejected at this layer — producers must
 * use names, not magic numbers.
 */
export function coercePriority(value: unknown): Priority {
    return isPriority(value) ? value : DEFAULT_PRIORITY;
}

// ────────────────────────────────────────────────────────────────────────────
// Per-plan concurrency caps
// ────────────────────────────────────────────────────────────────────────────

/**
 * Plan tier ladder. Mirrors `entitlements.ts` `PLAN_TABLE` plan ids and
 * the seat-model ADR's editor ladder (`free` / `starter` / `pro` /
 * `business` / `enterprise`). Kept as a string-literal union so a
 * forgotten plan upgrade is a compile error.
 *
 * Note this is the **same** literal set as `JobPlanTier` on the schema
 * side — we re-export under a local name to avoid an import cycle while
 * the queue package is still being assembled (sibling #1 schema → #2
 * enqueue → #4 concurrency).
 */
export type PlanTier = 'free' | 'starter' | 'pro' | 'business' | 'enterprise';

/**
 * Per-plan concurrency cap: the maximum number of jobs one workspace
 * may have in-flight (claimed but not terminal) on a single queue at
 * one instant. The dispatcher's Redis semaphore key is
 * `sabflow:queue:<queueName>:wsinflight:<workspaceId>`; this table
 * is the ceiling that semaphore enforces.
 *
 * Ladder rationale (mirrors seat-model §3.2 per-doc-editor curve so the
 * tenant's mental model is consistent: same plan tier → same "how
 * much can I do at once" intuition):
 *
 *   - `free`        — 1   (solo / hobby; one execution at a time)
 *   - `starter`     — 3   (small team)
 *   - `pro`         — 10  (typical SMB workload)
 *   - `business`    — 50  (heavy automation tenants)
 *   - `enterprise`  — 200 (large org; bounded above the seat ladder's
 *                          "unlimited" because we still want a single
 *                          tenant to not be able to monopolise a Redis
 *                          worker pool by accident — sales can lift via
 *                          add-on)
 *
 * `enterprise` is intentionally **finite** rather than `-1`/Infinity:
 * the dispatcher's Lua semaphore needs a concrete integer to compare
 * against, and "unlimited per workspace" doesn't bound the pool. If a
 * specific enterprise tenant needs a higher cap, it ships as a
 * per-workspace override (see `concurrencyCapForPlan()` JSDoc).
 */
export const CONCURRENCY_CAPS: Readonly<Record<PlanTier, number>> = Object.freeze({
    free: 1,
    starter: 3,
    pro: 10,
    business: 50,
    enterprise: 200,
});

/** Fallback used when the plan resolver returns an unknown / null value. */
const FALLBACK_PLAN: PlanTier = 'free';

/** Runtime guard for foreign input (admin tooling, replay scripts). */
export function isPlanTier(value: unknown): value is PlanTier {
    return (
        value === 'free' ||
        value === 'starter' ||
        value === 'pro' ||
        value === 'business' ||
        value === 'enterprise'
    );
}

/**
 * Resolve the concurrency cap for a plan tier. Unknown / null inputs
 * fall back to the `free` cap (1) — fail-closed, never fail-open. This
 * is the same posture `entitlements.ts` uses for unknown plan ids.
 *
 * Per-workspace overrides (Phase 8 will wire) should multiply, not
 * replace, the plan cap so a base-tier tenant with an add-on doesn't
 * silently regress when the add-on expires.
 */
export function concurrencyCapForPlan(plan: string | null | undefined): number {
    const key = (typeof plan === 'string' ? plan.toLowerCase() : '') as PlanTier;
    return CONCURRENCY_CAPS[isPlanTier(key) ? key : FALLBACK_PLAN];
}

/** Result shape for {@link canEnqueueAt}. */
export interface EnqueueGateResult {
    /** True iff `currentInFlight + 1 <= cap`. */
    allowed: boolean;
    /** The cap that was checked against; surfaced for telemetry / UX. */
    cap: number;
}

/**
 * Pre-flight gate the producer (sibling #2) can call before enqueueing.
 *
 * The **authoritative** enforcement lives in the Rust dispatcher's Lua
 * semaphore (sibling #3) — that's the only place where the check is
 * race-free against concurrent claims. This helper exists so the API
 * layer can fail fast with a 429-equivalent error before the job ever
 * hits Redis, and so the UI can render the cap in the rejection
 * message ("Your `pro` plan allows 10 in-flight runs; you have 10
 * — wait or upgrade").
 *
 * Contract:
 *
 *   - `currentInFlight` is the integer the caller reads with
 *     `GET sabflow:queue:<name>:wsinflight:<workspaceId>` (or zero if
 *     the key is missing). This module **does not** perform the read
 *     itself — that would couple it to a specific Redis client.
 *   - Returns `allowed = (currentInFlight < cap)`. We use strict-less
 *     so the dispatcher can atomically `INCR` after the check and still
 *     guarantee `<= cap`.
 *
 * @example
 *   const inflight = Number(
 *     (await redis.get(`sabflow:queue:${q}:wsinflight:${ws}`)) ?? 0,
 *   );
 *   const gate = canEnqueueAt('pro', inflight);
 *   if (!gate.allowed) {
 *     throw new HttpError(429, `cap=${gate.cap} in-flight=${inflight}`);
 *   }
 */
export function canEnqueueAt(
    plan: string | null | undefined,
    currentInFlight: number,
): EnqueueGateResult {
    const cap = concurrencyCapForPlan(plan);
    const safeInflight = Number.isFinite(currentInFlight)
        ? Math.max(0, Math.floor(currentInFlight))
        : 0;
    return { allowed: safeInflight < cap, cap };
}

/**
 * Build the canonical per-workspace in-flight counter key. Kept here so
 * both Node and Rust can derive the same key shape from the same source
 * (`schema.ts` owns top-level namespace; this file owns the
 * `wsinflight:` suffix because the counter is concurrency-specific,
 * not part of the Bull-compat wire schema).
 *
 * Layout: `sabflow:queue:<queueName>:wsinflight:<workspaceId>`.
 *
 * Producers that want to *display* current in-flight in admin UIs can
 * `GET` this key; the dispatcher Lua script is the only writer.
 */
export function workspaceInflightKey(
    queueName: string,
    workspaceId: string,
): string {
    return `sabflow:queue:${queueName}:wsinflight:${workspaceId}`;
}
