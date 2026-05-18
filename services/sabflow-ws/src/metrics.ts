/**
 * Health + Prometheus metrics endpoints for the SabFlow WS gateway.
 *
 * Track A · Phase 3 · sub-task #9 of 10. Owned exclusively by this file;
 * sibling #1 (`index.ts`) mounts `metricsRouter` at the application root and
 * calls `configureMetrics(...)` once at startup with its concrete deps.
 *
 * # Endpoints
 *
 *   GET /health
 *     200 -> { status: 'ok',   uptime, redis: 'ok',   version }
 *     503 -> { status: 'down', uptime, redis: 'down', version }
 *     `redis` is probed with a hard 500 ms timeout — a hung Redis must never
 *     stall a liveness probe past the watchdog window.
 *
 *   GET /metrics
 *     200 text/plain; version=0.0.4 (Prometheus exposition format) via
 *     `prom-client`'s default registry.
 *
 * # Metric taxonomy (matches `docs/adr/sabflow-executor-observability.md` §5
 *   label-hygiene rules — workspaceId / docId / userId are NEVER labels)
 *
 *   sabflow_ws_connections_active           Gauge       (no labels)
 *   sabflow_ws_rooms_active                 Gauge       (no labels)
 *   sabflow_ws_messages_total               Counter     { kind }
 *   sabflow_ws_frame_bytes                  Histogram   { direction }
 *   sabflow_ws_connection_duration_seconds  Histogram   (no labels)
 *   sabflow_ws_close_total                  Counter     { code }
 *   sabflow_ws_seat_rejections_total        Counter     { tier }
 *
 * `kind` ∈ { 'sync' | 'awareness' | 'batch' }       (3-value enum, bounded)
 * `direction` ∈ { 'in' | 'out' }                    (2-value enum, bounded)
 * `code` is a WebSocket close code (RFC 6455 1xxx + our 4xxx — bounded)
 * `tier` is a plan tier from `src/lib/plans.ts` (5 values — bounded)
 *
 * The two Gauges sample lazily on scrape via `prom-client`'s `collect()`
 * callback, so we never publish stale numbers and never need a sampling
 * goroutine.
 *
 * # Dependency (note for sibling #1's package.json)
 *
 *   "dependencies": {
 *     "prom-client": "^15.1.3"
 *     // (plus express, redis — already required by sibling #1)
 *   }
 */

import { Router, type Request, type Response } from 'express';
import {
  collectDefaultMetrics,
  Counter,
  Gauge,
  Histogram,
  Registry,
} from 'prom-client';

// ---------------------------------------------------------------------------
// Dependency wiring
// ---------------------------------------------------------------------------

/** Minimum Redis surface we need — `node-redis` v4's `RedisClientType` fits. */
export interface MetricsRedisLike {
  ping(): Promise<string>;
}

/** Deps the sibling-#1 bootstrap injects exactly once at startup. */
export interface MetricsDeps {
  /** Live connection-count source. Sibling #1 increments/decrements; we just read. */
  connectionCount(): number;
  /** Live room-count source (size of the room map). */
  roomsActiveCount(): number;
  /** Redis client used solely for the `/health` ping. */
  redis: MetricsRedisLike;
  /** Service version string — usually `process.env.npm_package_version`. */
  version: string;
}

/**
 * Lazy holder for deps so `metricsRouter` can be exported eagerly (sibling #1
 * does `app.use(metricsRouter)` before any connections arrive) while still
 * receiving its concrete wiring at boot.
 */
let deps: MetricsDeps | null = null;

/** Returns 0 (and never throws) until `configureMetrics` has been called. */
function getConnectionCount(): number {
  return deps ? deps.connectionCount() : 0;
}
function getRoomsActiveCount(): number {
  return deps ? deps.roomsActiveCount() : 0;
}

/**
 * Wire concrete deps. Call exactly once during service startup, before
 * `app.listen(...)`. Idempotent — second call overwrites (useful in tests).
 */
export function configureMetrics(d: MetricsDeps): void {
  deps = d;
}

/**
 * Test-only hook — drops the singleton registry contents and the deps holder.
 * Not exported for general use; lives behind a named export so unit tests can
 * spin up the router twice in the same process without `prom-client` throwing
 * "metric already registered".
 */
export function __resetMetricsForTests(): void {
  deps = null;
  registry.resetMetrics();
}

// ---------------------------------------------------------------------------
// Registry + metric instances
// ---------------------------------------------------------------------------

/**
 * We use a private registry rather than the global `prom-client` default so a
 * future test harness (or a Rust-shim adapter) can spin up multiple gateway
 * instances in one process without metric-name collisions.
 */
export const registry = new Registry();

// Tag the registry with the service identity per ADR §5 ("implicit service.name
// resource attribute; do not duplicate it as a label").
registry.setDefaultLabels({ service: 'sabflow-ws' });

// Standard Node.js process metrics (event-loop lag, heap, GC, etc.). Cheap to
// collect on scrape; gives ops a baseline before custom metrics matter.
collectDefaultMetrics({ register: registry, prefix: 'sabflow_ws_proc_' });

// --- Gauges (lazy collect on scrape) ---------------------------------------

const connectionsActive = new Gauge({
  name: 'sabflow_ws_connections_active',
  help: 'Number of currently-open WebSocket connections to the gateway.',
  registers: [registry],
  collect(): void {
    this.set(getConnectionCount());
  },
});

const roomsActive = new Gauge({
  name: 'sabflow_ws_rooms_active',
  help: 'Number of distinct doc rooms with at least one subscriber.',
  registers: [registry],
  collect(): void {
    this.set(getRoomsActiveCount());
  },
});

// --- Counters ---------------------------------------------------------------

/**
 * Frame-message counter. `kind` mirrors the ADR §4.1 tag-prefix taxonomy —
 *   sync       → tag 0x00 (Yjs sync protocol)
 *   awareness  → tag 0x01 (Yjs awareness protocol)
 *   batch      → tag 0x7F (server coalesced batch frame)
 */
const messagesTotal = new Counter({
  name: 'sabflow_ws_messages_total',
  help: 'Total Yjs frames observed by the gateway, partitioned by frame kind.',
  labelNames: ['kind'] as const,
  registers: [registry],
});

/** Close-code histogram is a Counter not a Histogram — close-code is discrete. */
const closeTotal = new Counter({
  name: 'sabflow_ws_close_total',
  help: 'Total WebSocket connection closes, partitioned by close code.',
  labelNames: ['code'] as const,
  registers: [registry],
});

const seatRejectionsTotal = new Counter({
  name: 'sabflow_ws_seat_rejections_total',
  help: 'Total handshake rejections due to plan-tier seat-limit, by plan tier.',
  labelNames: ['tier'] as const,
  registers: [registry],
});

// --- Histograms -------------------------------------------------------------

/**
 * Frame-size histogram. Buckets span 64 B (tiny awareness updates) to 256 KiB
 * (our `4413 payload-too-large` cap from ADR §5). Powers of 4 keep the bucket
 * count low while still distinguishing typical update sizes.
 */
const frameBytes = new Histogram({
  name: 'sabflow_ws_frame_bytes',
  help: 'WebSocket frame payload size in bytes, partitioned by direction.',
  labelNames: ['direction'] as const,
  buckets: [64, 256, 1024, 4096, 16384, 65536, 262144],
  registers: [registry],
});

/**
 * Connection-duration histogram. Buckets cover sub-second handshake-rejects
 * up to multi-hour editor sessions (ADR §3.5 heartbeat tolerance ≈ 70 s, so
 * we want resolution at and above that; the 4-hour tail catches "tab left
 * open overnight" sessions).
 */
const connectionDurationSeconds = new Histogram({
  name: 'sabflow_ws_connection_duration_seconds',
  help: 'Time a WebSocket connection stayed open, observed on close.',
  buckets: [0.1, 1, 5, 30, 120, 600, 1800, 7200, 14400],
  registers: [registry],
});

// ---------------------------------------------------------------------------
// Helpers consumed by the connection sibling (#1 / #5)
// ---------------------------------------------------------------------------

/** Frame-kind label values. Compile-time enum so misuse is a type error. */
export type FrameKind = 'sync' | 'awareness' | 'batch';
/** Direction label values. */
export type FrameDirection = 'in' | 'out';

/**
 * Record one observed WebSocket frame — increments `sabflow_ws_messages_total`
 * (partitioned by `kind`) and observes the payload size on
 * `sabflow_ws_frame_bytes` (partitioned by `direction`).
 *
 * Called from the connection handler exactly once per frame, after the tag
 * prefix has been peeled and dispatched.
 */
export function recordFrame(kind: FrameKind, direction: FrameDirection, bytes: number): void {
  messagesTotal.inc({ kind });
  frameBytes.observe({ direction }, bytes);
}

/**
 * Record a closed WebSocket. `code` is the numeric WS close code (RFC 6455
 * 1xxx or our 4xxx vocab from ADR §3.6 / §4.3); stringified to keep the
 * Prometheus label set predictable.
 *
 * `durationSeconds` is `connectionOpenedAt → close` in **seconds** (not ms).
 */
export function recordClose(code: number, durationSeconds: number): void {
  closeTotal.inc({ code: String(code) });
  connectionDurationSeconds.observe(durationSeconds);
}

/** Plan-tier values that count as seat-rejection buckets. */
export type SeatRejectionTier = 'free' | 'starter' | 'growth' | 'scale' | 'enterprise';

/** Record one handshake rejected by the seat-limit gate (§6.3 of the WS ADR). */
export function recordSeatRejection(tier: SeatRejectionTier): void {
  seatRejectionsTotal.inc({ tier });
}

// ---------------------------------------------------------------------------
// Express router
// ---------------------------------------------------------------------------

/**
 * Ping Redis with a hard 500 ms timeout. The deadline is enforced via
 * `Promise.race` rather than the Redis client's own command timeout so we
 * stay independent of how sibling #1 configures its client.
 */
async function pingRedisOrDown(redis: MetricsRedisLike, timeoutMs: number): Promise<'ok' | 'down'> {
  try {
    const reply = (await Promise.race([
      redis.ping(),
      new Promise<never>((_, rej) =>
        setTimeout(() => rej(new Error('redis ping timeout')), timeoutMs),
      ),
    ])) as string;
    return reply === 'PONG' ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

/**
 * Mounted at root by sibling #1: `app.use(metricsRouter)`. Both `/health` and
 * `/metrics` are intentionally unauthenticated — they are reached either by
 * the PM2 watchdog (localhost) or by the Prometheus scraper (network-policy
 * restricted), neither of which has a JWT to present.
 */
export const metricsRouter: Router = Router();

metricsRouter.get('/health', async (_req: Request, res: Response): Promise<void> => {
  const version = deps?.version ?? 'unknown';
  const uptime = process.uptime();
  // Service health depends on Redis (we need it for seat counters and Phase 7
  // multi-instance fan-out). Without `configureMetrics`, we can't probe Redis
  // — that itself is "down" from the platform's perspective.
  const redisState: 'ok' | 'down' = deps
    ? await pingRedisOrDown(deps.redis, 500)
    : 'down';
  const status = redisState === 'ok' ? 'ok' : 'down';
  res.status(status === 'ok' ? 200 : 503).json({
    status,
    uptime,
    redis: redisState,
    version,
  });
});

metricsRouter.get('/metrics', async (_req: Request, res: Response): Promise<void> => {
  try {
    const body = await registry.metrics();
    res.setHeader('Content-Type', registry.contentType);
    res.status(200).send(body);
  } catch (err) {
    // `prom-client` only throws here if a custom `collect()` callback throws.
    // Surface that as a 500 with a one-line text body so the scraper records
    // the failure cleanly rather than retrying against a hung handler.
    res
      .status(500)
      .type('text/plain')
      .send(`# metrics collection failed: ${err instanceof Error ? err.message : String(err)}\n`);
  }
});
