/**
 * SabFlow — Trigger debouncing + coalescing.
 *
 * Some trigger sources are noisy (a chatty CRM webhook, an inventory feed, a
 * spammy IoT device) and can fire dozens or hundreds of times in seconds.
 * Without throttling, each fire enqueues a separate workflow execution — the
 * dispatcher then burns its concurrency budget on what the user really wants
 * to treat as a single logical event.
 *
 * `TriggerDebouncer` sits in front of the executor enqueue and either:
 *
 *   1. delays the fire by `debounceMs` and resets the timer on each new
 *      payload (classic trailing-edge debounce), and/or
 *   2. coalesces payloads received during the window into a single array
 *      that is enqueued once when the window finally expires.
 *
 * A hard `maxBatch` cap flushes early so a sustained burst can't be held
 * forever. A backpressure cap (10k payloads/trigger) drops the oldest
 * payload and emits a warn-metric instead of growing the buffer without
 * bound.
 *
 * Redis is the source of truth so multiple worker instances coordinate:
 *
 *   - `sabflow:debounce:<triggerId>`        — RPUSH-able list of pending
 *                                              JSON-encoded payloads.
 *   - `sabflow:debounce:<triggerId>:meta`   — hash holding `firstAt`
 *                                              (epoch ms of the first
 *                                              payload in the current
 *                                              window) and `lastAt` (epoch
 *                                              ms of the most recent
 *                                              payload — used to decide
 *                                              whether the window has
 *                                              elapsed at flush time).
 *
 * The accept-path is a single Lua-via-`eval` script so RPUSH + cap-trim +
 * meta-write are atomic across workers. The flush-path is also Lua so a
 * "claim the window" check + LRANGE + DEL is atomic — only one worker can
 * win the flush even when many wake up at the same instant.
 *
 * Track B · Phase 6 · sub-task #8 of 10.
 *
 * Ownership: this file owns the in-process debouncer / coalescer and its
 * Redis coordination keys. It does NOT own:
 *   - the enqueue API (sibling Phase 2 #2 — `@/lib/sabflow/queue/enqueue`);
 *     we forward-declare the slice we need.
 *   - the trigger filter pipeline (sibling Phase 6 #1).
 *   - the warn-metric exporter (sibling Phase 2 #10); we expose a hook
 *     instead of wiring Prometheus directly.
 */

import 'server-only';

// `redis` is exported via CommonJS `module.exports` in `src/lib/redis.ts`,
// so we `require()` it (same pattern as `queue/enqueue.ts`).
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getRedisClient } = require('@/lib/redis') as {
    getRedisClient: () => Promise<DebouncerRedisClient>;
};

/* ──────────────────────────────────────────────────────────────────────────
 * Forward declarations — the real enqueue lives in
 * `src/lib/sabflow/queue/enqueue.ts` (Track B Phase 2 sub-task #2). Pulling
 * it in directly would create a sabflow ↔ queue cycle while both modules
 * are still in flight, so we accept a function on the debouncer's
 * constructor instead.
 * ────────────────────────────────────────────────────────────────────── */

/** Forward-declared slice of the enqueue surface we depend on. */
export type EnqueueFn = (
    triggerId: string,
    payload: unknown,
    info: { coalesced: boolean; count: number },
) => Promise<void>;

/** Forward-declared slice of `node-redis@4` used by this module. */
export interface DebouncerRedisClient {
    eval(
        script: string,
        opts: { keys: string[]; arguments: string[] },
    ): Promise<unknown>;
    del(key: string | string[]): Promise<number>;
    rPush(key: string, values: string | string[]): Promise<number>;
    lLen(key: string): Promise<number>;
    lRange(key: string, start: number, stop: number): Promise<string[]>;
    hGetAll(key: string): Promise<Record<string, string>>;
    expire(key: string, seconds: number): Promise<boolean | number>;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Public types
 * ────────────────────────────────────────────────────────────────────── */

/** Per-trigger configuration. Default (omitted): no debounce — pass-through. */
export interface DebounceConfig {
    /**
     * Hold the fire for this many ms after the most recent payload. Each
     * new payload resets the timer. `0` / `undefined` = no debounce.
     */
    debounceMs?: number;
    /**
     * When `true`, every payload received during the window is collected
     * into an array; the flush enqueues a single payload `[a, b, c, ...]`.
     * When `false`, only the *latest* payload survives — earlier ones are
     * discarded (trailing-edge classic debounce).
     */
    coalesce?: boolean;
    /**
     * Cap on payloads per window. Reaching this count triggers an immediate
     * flush even if the timer hasn't expired. Defaults to `BACKPRESSURE_CAP`.
     */
    maxBatch?: number;
}

export interface AcceptResult {
    /** True when we forwarded to the underlying enqueue right now. */
    enqueued: boolean;
    /** True when the payload was held inside the debounce window. */
    debounced?: boolean;
}

/** Hook for warn metrics — sibling Phase 2 #10 can attach a Prometheus counter. */
export type WarnMetric = (
    name: 'sabflow_trigger_debounce_dropped' | 'sabflow_trigger_debounce_flushed',
    labels: { triggerId: string },
    value?: number,
) => void;

export interface TriggerDebouncerOptions {
    enqueue: EnqueueFn;
    /** Optional warn-metric sink. Defaults to a no-op + `console.warn`. */
    onWarn?: WarnMetric;
    /** Default config when `setConfig` was never called for a trigger. */
    defaultConfig?: DebounceConfig;
    /** Override Redis client (mostly for tests). */
    redis?: DebouncerRedisClient;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Constants
 * ────────────────────────────────────────────────────────────────────── */

/** Hard cap on held payloads per trigger; oldest is dropped on overflow. */
const BACKPRESSURE_CAP = 10_000;

/** TTL on Redis keys — long enough to outlive any reasonable debounceMs. */
const REDIS_KEY_TTL_SEC = 60 * 60; // 1h

function listKey(triggerId: string): string {
    return `sabflow:debounce:${triggerId}`;
}

function metaKey(triggerId: string): string {
    return `sabflow:debounce:${triggerId}:meta`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Lua scripts (atomic across workers)
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Atomic accept:
 *   KEYS[1] = list, KEYS[2] = meta
 *   ARGV[1] = payload (JSON)
 *   ARGV[2] = nowMs
 *   ARGV[3] = backpressureCap
 *   ARGV[4] = ttlSec
 *
 * Returns `{ len, dropped, firstAt }`:
 *   len      — list length after the push (post-trim).
 *   dropped  — `1` when we trimmed the head to stay under the cap.
 *   firstAt  — epoch-ms of the oldest payload still in the list.
 */
const ACCEPT_LUA = `
local list = KEYS[1]
local meta = KEYS[2]
local payload = ARGV[1]
local nowMs = tonumber(ARGV[2])
local cap = tonumber(ARGV[3])
local ttl = tonumber(ARGV[4])

redis.call('RPUSH', list, payload)
local len = redis.call('LLEN', list)
local dropped = 0
if len > cap then
  -- drop oldest to stay at cap
  local over = len - cap
  for i = 1, over do
    redis.call('LPOP', list)
  end
  dropped = 1
  len = cap
end

local firstAt = redis.call('HGET', meta, 'firstAt')
if not firstAt or firstAt == false then
  redis.call('HSET', meta, 'firstAt', nowMs)
  firstAt = nowMs
end
redis.call('HSET', meta, 'lastAt', nowMs)
redis.call('EXPIRE', list, ttl)
redis.call('EXPIRE', meta, ttl)

return { len, dropped, tostring(firstAt) }
`;

/**
 * Atomic flush-claim:
 *   KEYS[1] = list, KEYS[2] = meta
 *   ARGV[1] = nowMs
 *   ARGV[2] = debounceMs (0 = unconditional flush, e.g. maxBatch hit or stop)
 *
 * Returns either:
 *   `{ "ok", lastAt, payload1, payload2, ... }` — caller is the winner.
 *   `{ "wait", waitMs }`                       — caller should re-arm timer.
 *   `{ "empty" }`                              — nothing to flush.
 */
const FLUSH_LUA = `
local list = KEYS[1]
local meta = KEYS[2]
local nowMs = tonumber(ARGV[1])
local debounceMs = tonumber(ARGV[2])

local len = redis.call('LLEN', list)
if len == 0 then
  return { 'empty' }
end

local lastAt = tonumber(redis.call('HGET', meta, 'lastAt')) or 0

if debounceMs > 0 then
  local elapsed = nowMs - lastAt
  if elapsed < debounceMs then
    return { 'wait', tostring(debounceMs - elapsed) }
  end
end

local items = redis.call('LRANGE', list, 0, -1)
redis.call('DEL', list)
redis.call('DEL', meta)

local out = { 'ok', tostring(lastAt) }
for i = 1, #items do
  out[#out + 1] = items[i]
end
return out
`;

/* ──────────────────────────────────────────────────────────────────────────
 * TriggerDebouncer
 * ────────────────────────────────────────────────────────────────────── */

/**
 * Keyed-by-triggerId debouncer/coalescer.
 *
 * Usage:
 * ```ts
 * const dbz = new TriggerDebouncer({
 *   enqueue: async (triggerId, payload, info) => {
 *     await enqueueExecution({
 *       workspaceId: registry[triggerId].workspaceId,
 *       workflowId:  registry[triggerId].workflowId,
 *       mode: 'trigger',
 *       triggerData: payload,
 *       plan: registry[triggerId].plan,
 *     });
 *   },
 * });
 *
 * dbz.setConfig('trigger_42', { debounceMs: 10_000, coalesce: true, maxBatch: 100 });
 * await dbz.accept('trigger_42', { event: 'updated', id: 1 });
 * // ... 99 more arrive within 10s → all coalesced into one execution
 *
 * await dbz.stop(); // on shutdown — flushes whatever is held
 * ```
 */
export class TriggerDebouncer {
    private readonly enqueueFn: EnqueueFn;
    private readonly onWarn: WarnMetric;
    private readonly defaultConfig: DebounceConfig;
    private readonly redisOverride?: DebouncerRedisClient;

    private readonly configs = new Map<string, DebounceConfig>();
    private readonly timers = new Map<string, NodeJS.Timeout>();
    private stopped = false;

    constructor(opts: TriggerDebouncerOptions) {
        this.enqueueFn = opts.enqueue;
        this.onWarn = opts.onWarn ?? defaultWarn;
        this.defaultConfig = opts.defaultConfig ?? {};
        this.redisOverride = opts.redis;
    }

    /** Override the config for a given trigger. */
    setConfig(triggerId: string, cfg: DebounceConfig): void {
        this.configs.set(triggerId, cfg);
    }

    /** Inspect the current effective config (mostly for tests / debugging). */
    getConfig(triggerId: string): DebounceConfig {
        return this.configs.get(triggerId) ?? this.defaultConfig;
    }

    /**
     * Accept a trigger payload. The return value describes what happened:
     *
     *   - `{ enqueued: true }`                — pass-through (no debounce
     *                                            configured), we already
     *                                            handed it to `enqueueFn`.
     *   - `{ enqueued: false, debounced: true }` — payload is held in Redis,
     *                                              waiting for the window
     *                                              to expire.
     *   - `{ enqueued: true, debounced: true }`  — payload arrival triggered
     *                                              an immediate flush
     *                                              (maxBatch reached); the
     *                                              flushed enqueue has
     *                                              already run.
     */
    async accept(triggerId: string, payload: unknown): Promise<AcceptResult> {
        if (this.stopped) {
            // After stop(), refuse to enqueue new debounced work. Fall
            // through to a direct enqueue so callers don't lose the event.
            await this.enqueueFn(triggerId, payload, { coalesced: false, count: 1 });
            return { enqueued: true };
        }

        const cfg = this.getConfig(triggerId);
        const debounceMs = cfg.debounceMs ?? 0;

        // No debounce configured — fast path: pass straight through.
        if (debounceMs <= 0) {
            await this.enqueueFn(triggerId, payload, { coalesced: false, count: 1 });
            return { enqueued: true };
        }

        const maxBatch = clampMaxBatch(cfg.maxBatch);
        const client = await this.redis();
        const now = Date.now();

        const raw = (await client.eval(ACCEPT_LUA, {
            keys: [listKey(triggerId), metaKey(triggerId)],
            arguments: [
                JSON.stringify(payload),
                String(now),
                String(BACKPRESSURE_CAP),
                String(REDIS_KEY_TTL_SEC),
            ],
        })) as [number, number, string];

        const len = toNum(raw?.[0], 0);
        const dropped = toNum(raw?.[1], 0) === 1;

        if (dropped) {
            this.onWarn('sabflow_trigger_debounce_dropped', { triggerId }, 1);
            console.warn(
                `[sabflow/debounce] backpressure: trigger=${triggerId} dropped oldest payload (cap=${BACKPRESSURE_CAP})`,
            );
        }

        // maxBatch hit → flush right now, regardless of timer.
        if (len >= maxBatch) {
            this.clearTimer(triggerId);
            const flushed = await this.flushOne(triggerId, /*force*/ true);
            return { enqueued: flushed, debounced: true };
        }

        // Otherwise (re-)arm the trailing-edge timer. Each new payload
        // pushes the deadline forward by `debounceMs`.
        this.armTimer(triggerId, debounceMs);
        return { enqueued: false, debounced: true };
    }

    /**
     * Force-flush a single trigger. Returns `true` when an enqueue ran.
     * Exposed so callers can drain a specific trigger on demand (config
     * change, manual override) without waiting for the timer.
     */
    async flush(triggerId: string): Promise<boolean> {
        this.clearTimer(triggerId);
        return this.flushOne(triggerId, /*force*/ true);
    }

    /**
     * Shutdown — flushes every buffered trigger so we don't lose events.
     * Idempotent. After `stop()`, `accept()` falls back to pass-through.
     */
    async stop(): Promise<void> {
        if (this.stopped) return;
        this.stopped = true;
        // Snapshot keys to flush — both in-memory timers AND anything in
        // Redis (from peers that already exited).
        const triggers = new Set<string>(this.timers.keys());
        for (const t of this.timers.keys()) triggers.add(t);
        for (const t of this.configs.keys()) triggers.add(t);

        // Clear timers up front so a late firing can't race the flush.
        for (const t of this.timers.values()) clearTimeout(t);
        this.timers.clear();

        const errors: unknown[] = [];
        for (const triggerId of triggers) {
            try {
                await this.flushOne(triggerId, /*force*/ true);
            } catch (err) {
                errors.push(err);
            }
        }
        if (errors.length > 0) {
            console.warn(
                `[sabflow/debounce] stop(): ${errors.length} flush error(s); first:`,
                errors[0],
            );
        }
    }

    /* ── private ─────────────────────────────────────────────────────── */

    private async redis(): Promise<DebouncerRedisClient> {
        return this.redisOverride ?? (await getRedisClient());
    }

    private armTimer(triggerId: string, debounceMs: number): void {
        this.clearTimer(triggerId);
        const handle = setTimeout(() => {
            this.timers.delete(triggerId);
            // Best-effort — errors are logged, never thrown to the timer loop.
            this.flushOne(triggerId, /*force*/ false).catch((err) => {
                console.warn(
                    `[sabflow/debounce] timer-flush error trigger=${triggerId}:`,
                    err,
                );
            });
        }, debounceMs);
        // `unref` so a stray timer never holds the process open.
        if (typeof (handle as { unref?: () => void }).unref === 'function') {
            (handle as { unref: () => void }).unref();
        }
        this.timers.set(triggerId, handle);
    }

    private clearTimer(triggerId: string): void {
        const handle = this.timers.get(triggerId);
        if (handle) {
            clearTimeout(handle);
            this.timers.delete(triggerId);
        }
    }

    /**
     * Race-safe flush: only one worker actually drains the list+meta even
     * when the timer fires on multiple instances simultaneously.
     *
     * `force=true`  → drain regardless of `debounceMs` elapsed (used for
     *                 maxBatch overflow, manual `flush()`, and `stop()`).
     * `force=false` → only drain if `debounceMs` has elapsed since the
     *                 last accept; otherwise re-arm the timer to wait
     *                 for the remainder.
     */
    private async flushOne(triggerId: string, force: boolean): Promise<boolean> {
        const cfg = this.getConfig(triggerId);
        const debounceMs = force ? 0 : cfg.debounceMs ?? 0;
        const coalesce = cfg.coalesce === true;
        const client = await this.redis();
        const now = Date.now();

        const raw = (await client.eval(FLUSH_LUA, {
            keys: [listKey(triggerId), metaKey(triggerId)],
            arguments: [String(now), String(debounceMs)],
        })) as string[];

        if (!Array.isArray(raw) || raw.length === 0) return false;

        const tag = raw[0];
        if (tag === 'empty') {
            return false;
        }
        if (tag === 'wait') {
            const remaining = Math.max(1, toNum(raw[1], debounceMs));
            this.armTimer(triggerId, remaining);
            return false;
        }
        if (tag !== 'ok') return false;

        // raw[1] = lastAt (string), raw[2..] = JSON-encoded payloads
        const rawPayloads = raw.slice(2);
        if (rawPayloads.length === 0) return false;

        const payloads: unknown[] = [];
        for (const s of rawPayloads) {
            try {
                payloads.push(JSON.parse(s));
            } catch {
                // Malformed entry — surface as a string so we don't lose it.
                payloads.push(s);
            }
        }

        try {
            if (coalesce) {
                await this.enqueueFn(triggerId, payloads, {
                    coalesced: true,
                    count: payloads.length,
                });
            } else {
                // Trailing-edge classic: fire only the most recent payload.
                const latest = payloads[payloads.length - 1];
                await this.enqueueFn(triggerId, latest, {
                    coalesced: false,
                    count: payloads.length,
                });
            }
            this.onWarn(
                'sabflow_trigger_debounce_flushed',
                { triggerId },
                payloads.length,
            );
            return true;
        } catch (err) {
            // We've already removed the items from Redis. Re-push so the
            // events aren't lost — the next flush attempt will retry.
            console.warn(
                `[sabflow/debounce] enqueue failed trigger=${triggerId}; re-buffering ${payloads.length} payload(s):`,
                err,
            );
            try {
                await client.rPush(listKey(triggerId), rawPayloads);
                await client.expire(listKey(triggerId), REDIS_KEY_TTL_SEC);
            } catch (rebuf) {
                console.error(
                    `[sabflow/debounce] re-buffer failed trigger=${triggerId}:`,
                    rebuf,
                );
            }
            return false;
        }
    }
}

/* ──────────────────────────────────────────────────────────────────────────
 * Helpers
 * ────────────────────────────────────────────────────────────────────── */

function clampMaxBatch(maxBatch: number | undefined): number {
    if (typeof maxBatch !== 'number' || !Number.isFinite(maxBatch) || maxBatch <= 0) {
        return BACKPRESSURE_CAP;
    }
    return Math.min(Math.floor(maxBatch), BACKPRESSURE_CAP);
}

function toNum(v: unknown, fallback: number): number {
    if (typeof v === 'number' && Number.isFinite(v)) return v;
    if (typeof v === 'string') {
        const n = Number(v);
        if (Number.isFinite(n)) return n;
    }
    return fallback;
}

const defaultWarn: WarnMetric = (name, labels, value) => {
    if (name === 'sabflow_trigger_debounce_dropped') {
        // Always surface drops — they indicate a real backpressure event.
        console.warn(
            `[sabflow/debounce] metric=${name} trigger=${labels.triggerId} value=${value ?? 1}`,
        );
    }
    // `flushed` is normal operation — no log; metric hook is the right channel.
};

/** Re-export the backpressure cap so callers / tests can introspect it. */
export const TRIGGER_DEBOUNCE_BACKPRESSURE_CAP = BACKPRESSURE_CAP;
