/**
 * SabFlow queue metrics sampler (Track B · Phase 2 · sub-task #10).
 *
 * Periodically polls Redis for each BullMQ queue used by the SabFlow
 * executor and exposes a small set of Prometheus gauges describing depth,
 * age, and tier breakdown (waiting / active / failed / DLQ / delayed).
 *
 * Designed as an *exporter*, not a hard-wired endpoint. Any process that
 * can reach Redis can:
 *
 *   1. Call `sampleQueueGauges()` on an interval (default 15 s).
 *   2. Serialize the in-memory registry with `renderPrometheusText()`.
 *   3. Hand the body to its own HTTP `/metrics` handler.
 *
 * The dedicated WebSocket-gateway metrics endpoint
 * (`services/sabflow-ws/src/metrics.ts`, sibling track) already follows this
 * shape; the Phase B.10 service-level endpoint will too.
 *
 * Cardinality rule (see `docs/adr/sabflow-executor-observability.md` §5):
 *   - `queue` is the ONLY label. Bounded set: `executions | webhooks | cron`.
 *   - `workspaceId` is NEVER a label on these metrics.
 */

import 'server-only';
import type { Redis } from 'ioredis';

/* ──────────────────────────────────────────────────────────────────────────
 * Queue map
 * ──────────────────────────────────────────────────────────────────────── */

/** Logical queue identifier used as the `queue` Prometheus label. */
export type QueueId = 'executions' | 'webhooks' | 'cron';

/**
 * Map from logical queue id to the BullMQ queue name (which becomes part of
 * the Redis key, e.g. `bull:sabflow-executions:wait`). Kept in one place so
 * downstream services and the dispatcher use the same names.
 */
export const QUEUE_NAMES: Readonly<Record<QueueId, string>> = Object.freeze({
  executions: 'sabflow-executions',
  webhooks: 'sabflow-webhooks',
  cron: 'sabflow-cron',
});

/** Bounded label set — used to pre-register gauges for every queue id. */
export const QUEUE_IDS: readonly QueueId[] = Object.freeze([
  'executions',
  'webhooks',
  'cron',
]) as readonly QueueId[];

/** BullMQ default key prefix. Override via env if a deployment customises it. */
const BULL_PREFIX = process.env.SABFLOW_BULL_PREFIX ?? 'bull';

function key(queue: QueueId, suffix: string): string {
  return `${BULL_PREFIX}:${QUEUE_NAMES[queue]}:${suffix}`;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Snapshot type
 * ──────────────────────────────────────────────────────────────────────── */

export interface QueueDepth {
  /** `LLEN bull:<queue>:wait` — jobs queued and waiting to be claimed. */
  wait: number;
  /** `LLEN bull:<queue>:active` — jobs currently held by a worker. */
  active: number;
  /** `LLEN bull:<queue>:failed` — jobs that exhausted retries. */
  failed: number;
  /**
   * `LLEN bull:<queue>:dlq` — jobs moved to the dead-letter queue
   * (separate from BullMQ's native `failed` list).
   */
  dlq: number;
  /** `ZCARD bull:<queue>:delayed` — jobs scheduled for the future. */
  delayed: number;
  /**
   * Age of the oldest job in `wait` in seconds, or `0` if `wait` is empty.
   *
   * Computed by reading the tail of the wait list (`LINDEX wait -1`) and
   * looking at that job hash's `timestamp` field. The wait list is a stack
   * with `LPUSH` / `RPOPLPUSH`, so the *tail* is the oldest entry.
   */
  oldestAgeSeconds: number;
}

export interface QueueGaugesSnapshot {
  /** Unix millis when the sample finished. */
  sampledAt: number;
  /** Per-queue depth + age. */
  queues: Record<QueueId, QueueDepth>;
}

/* ──────────────────────────────────────────────────────────────────────────
 * Sampler
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * One-shot sample of every tracked queue. Pure (no side effects on its own
 * registry caller) — callers feed the result into `recordSnapshot()` to
 * update the gauges.
 *
 * Uses a single Redis pipeline per queue (5 commands) to keep the round-trip
 * count bounded regardless of queue count. Failures on individual queues
 * are surfaced as zeros — observability code must never throw and take down
 * its caller.
 */
export async function sampleQueueGauges(
  redis: Redis,
  now: () => number = Date.now,
): Promise<QueueGaugesSnapshot> {
  const sampledAt = now();
  const queues = {} as Record<QueueId, QueueDepth>;

  for (const id of QUEUE_IDS) {
    queues[id] = await sampleOne(redis, id, sampledAt).catch(() => emptyDepth());
  }

  return { sampledAt, queues };
}

async function sampleOne(
  redis: Redis,
  id: QueueId,
  sampledAt: number,
): Promise<QueueDepth> {
  const pipeline = redis.pipeline();
  pipeline.llen(key(id, 'wait'));
  pipeline.llen(key(id, 'active'));
  pipeline.llen(key(id, 'failed'));
  pipeline.llen(key(id, 'dlq'));
  pipeline.zcard(key(id, 'delayed'));
  pipeline.lindex(key(id, 'wait'), -1);

  const results = await pipeline.exec();
  if (!results) return emptyDepth();

  const wait = num(results[0]);
  const active = num(results[1]);
  const failed = num(results[2]);
  const dlq = num(results[3]);
  const delayed = num(results[4]);
  const oldestJobId = str(results[5]);

  let oldestAgeSeconds = 0;
  if (oldestJobId) {
    const ts = await redis
      .hget(`${BULL_PREFIX}:${QUEUE_NAMES[id]}:${oldestJobId}`, 'timestamp')
      .catch(() => null);
    if (ts) {
      const enqueuedAt = Number(ts);
      if (Number.isFinite(enqueuedAt) && enqueuedAt > 0) {
        oldestAgeSeconds = Math.max(0, (sampledAt - enqueuedAt) / 1000);
      }
    }
  }

  return { wait, active, failed, dlq, delayed, oldestAgeSeconds };
}

function num(entry: [Error | null, unknown] | undefined): number {
  if (!entry || entry[0]) return 0;
  const v = entry[1];
  return typeof v === 'number' ? v : Number(v ?? 0) || 0;
}

function str(entry: [Error | null, unknown] | undefined): string | null {
  if (!entry || entry[0]) return null;
  const v = entry[1];
  return typeof v === 'string' && v.length > 0 ? v : null;
}

function emptyDepth(): QueueDepth {
  return { wait: 0, active: 0, failed: 0, dlq: 0, delayed: 0, oldestAgeSeconds: 0 };
}

/* ──────────────────────────────────────────────────────────────────────────
 * Tiny in-process gauge registry
 * ──────────────────────────────────────────────────────────────────────── */

/**
 * We intentionally do NOT depend on `prom-client` here. The repo does not
 * declare it as a dep, and this module needs to be importable by lightweight
 * sidecars. We keep a hand-rolled registry whose surface is small enough to
 * later swap for `prom-client` without touching call sites.
 */
type GaugeKind =
  | 'sabflow_queue_wait'
  | 'sabflow_queue_active'
  | 'sabflow_queue_failed'
  | 'sabflow_queue_dlq'
  | 'sabflow_queue_delayed'
  | 'sabflow_queue_oldest_age_seconds';

const GAUGE_HELP: Readonly<Record<GaugeKind, string>> = Object.freeze({
  sabflow_queue_wait:
    'SabFlow BullMQ queue — jobs currently waiting (LLEN bull:<q>:wait).',
  sabflow_queue_active:
    'SabFlow BullMQ queue — jobs currently held by a worker (LLEN bull:<q>:active).',
  sabflow_queue_failed:
    'SabFlow BullMQ queue — jobs that exhausted retries (LLEN bull:<q>:failed).',
  sabflow_queue_dlq:
    'SabFlow BullMQ queue — dead-letter queue depth (LLEN bull:<q>:dlq).',
  sabflow_queue_delayed:
    'SabFlow BullMQ queue — jobs scheduled for the future (ZCARD bull:<q>:delayed).',
  sabflow_queue_oldest_age_seconds:
    'SabFlow BullMQ queue — age in seconds of the oldest job in the wait list.',
});

/**
 * In-memory gauge values keyed by `<metric>{queue="<id>"}`. Re-pre-allocated
 * with all bounded combinations on module load so a scrape that arrives
 * before the first sample still returns zeros rather than nothing.
 */
const gauges = new Map<string, number>();

function gkey(metric: GaugeKind, queue: QueueId): string {
  return `${metric}{queue="${queue}"}`;
}

// Pre-seed all bounded combinations with 0.
(function preseed(): void {
  for (const m of Object.keys(GAUGE_HELP) as GaugeKind[]) {
    for (const q of QUEUE_IDS) gauges.set(gkey(m, q), 0);
  }
})();

/**
 * Update the gauge registry from a sample snapshot. Idempotent.
 */
export function recordSnapshot(snap: QueueGaugesSnapshot): void {
  for (const id of QUEUE_IDS) {
    const d = snap.queues[id];
    if (!d) continue;
    gauges.set(gkey('sabflow_queue_wait', id), d.wait);
    gauges.set(gkey('sabflow_queue_active', id), d.active);
    gauges.set(gkey('sabflow_queue_failed', id), d.failed);
    gauges.set(gkey('sabflow_queue_dlq', id), d.dlq);
    gauges.set(gkey('sabflow_queue_delayed', id), d.delayed);
    gauges.set(gkey('sabflow_queue_oldest_age_seconds', id), d.oldestAgeSeconds);
  }
}

/** Read-only snapshot of the current registry, for tests. */
export function readGauges(): ReadonlyMap<string, number> {
  return new Map(gauges);
}

/**
 * Serialize the current gauge registry as Prometheus text-format. The
 * caller plugs the result into its own HTTP `/metrics` handler.
 */
export function renderPrometheusText(): string {
  const lines: string[] = [];
  for (const metric of Object.keys(GAUGE_HELP) as GaugeKind[]) {
    lines.push(`# HELP ${metric} ${GAUGE_HELP[metric]}`);
    lines.push(`# TYPE ${metric} gauge`);
    for (const q of QUEUE_IDS) {
      const v = gauges.get(gkey(metric, q)) ?? 0;
      lines.push(`${metric}{queue="${q}"} ${v}`);
    }
  }
  return lines.join('\n') + '\n';
}

/* ──────────────────────────────────────────────────────────────────────────
 * Periodic sampler
 * ──────────────────────────────────────────────────────────────────────── */

export interface SamplerHandle {
  /** Stops the timer. Safe to call multiple times. */
  stop(): void;
  /** Run one sample immediately (out-of-band). */
  sampleNow(): Promise<QueueGaugesSnapshot>;
}

export interface StartSamplerOptions {
  /** Poll interval in milliseconds. Default: 15 000 (15 s). */
  intervalMs?: number;
  /**
   * Called when a sample throws (after individual queue errors are already
   * suppressed). Default: `console.warn`.
   */
  onError?: (err: unknown) => void;
}

/**
 * Start a periodic sampler. Returns a handle so the caller (test, sidecar
 * shutdown hook, etc.) can stop it cleanly.
 *
 * The sampler runs the first sample on next tick, NOT synchronously, so
 * importing this module never dials Redis.
 */
export function startQueueGaugeSampler(
  redis: Redis,
  opts: StartSamplerOptions = {},
): SamplerHandle {
  const intervalMs = opts.intervalMs ?? 15_000;
  const onError =
    opts.onError ??
    ((e: unknown): void => {
      // eslint-disable-next-line no-console
      console.warn('[sabflow/queue/metrics] sample failed', e);
    });

  let stopped = false;
  let timer: NodeJS.Timeout | null = null;

  const tick = async (): Promise<void> => {
    if (stopped) return;
    try {
      const snap = await sampleQueueGauges(redis);
      recordSnapshot(snap);
    } catch (e) {
      onError(e);
    } finally {
      if (!stopped) timer = setTimeout(tick, intervalMs);
    }
  };

  // Kick off on next tick to keep `import` side-effect-free of Redis I/O.
  timer = setTimeout(tick, 0);

  return {
    stop(): void {
      stopped = true;
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
    },
    async sampleNow(): Promise<QueueGaugesSnapshot> {
      const snap = await sampleQueueGauges(redis);
      recordSnapshot(snap);
      return snap;
    },
  };
}
