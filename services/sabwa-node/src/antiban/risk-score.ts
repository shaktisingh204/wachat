/**
 * Ban-risk scoring.
 *
 * SABWA_PLAN.md §9.6 — turn recent failure signals into a clamped 0..100
 * gauge that the Sessions UI renders as a coloured ring. Pure scoring
 * (no I/O) so it can be called from a REST handler, the scheduler tick,
 * or `getStatus()` without dragging in Redis.
 *
 * Ban-signal counters are accumulated in Redis by the sessions / send
 * pipelines; see `recordSendFailure` / `recordBlockedBy` below. The
 * helper `compose(...)` reads those counters and feeds them into
 * `compute(...)`. Both are exported so callers that already have the
 * inputs in hand (e.g. unit tests) can skip Redis.
 *
 * ## Weighting model
 *
 * | Signal                          | Multiplier | Cap | Rationale |
 * |---------------------------------|-----------:|----:|-----------|
 * | `fails60s`                      |        6×  | 30  | Hard, immediate signal. |
 * | `fails60m`                      |        1×  | 20  | Medium-term trend. |
 * | `blockedByRecipients24h`        |       10×  | 30  | Strongest single predictor. |
 * | `velocityBreaches60m`           |        4×  | 15  | Bursty pattern. |
 * | session-age bonus               |        —   | -10 | Older = safer. |
 *
 * The raw sum is clamped to `0..100` and bucketed; see `RiskLevel`.
 *
 * Ported from `services/sabwa-engine/src/antiban/risk_score.rs` to
 * preserve scoring parity with the legacy Rust engine.
 */

import type { RedisHandles } from '../db/redis.js';

/** Discrete buckets the gauge UI renders. */
export type RiskLevel = 'healthy' | 'caution' | 'elevated' | 'critical';

/** Inputs to the scoring function. All counts are non-negative. */
export interface RiskInputs {
  fails60s: number;
  fails60m: number;
  blockedByRecipients24h: number;
  velocityBreaches60m: number;
  sessionAgeDays: number;
}

/** Output of `compute(...)` — what `getStatus()` surfaces. */
export interface RiskScore {
  /** 0..100, inclusive. Higher = worse. */
  value: number;
  level: RiskLevel;
  /** Human-readable list of which signals contributed, in eval order. */
  reasons: string[];
}

/**
 * Pure scoring function. See module-level docs for the weighting model.
 * Inputs are clamped non-negative; NaN / Infinity are treated as 0 so a
 * bad upstream counter never poisons the gauge.
 */
export function compute(inputs: RiskInputs): RiskScore {
  const f60s = clampNonNeg(inputs.fails60s);
  const f60m = clampNonNeg(inputs.fails60m);
  const blocks = clampNonNeg(inputs.blockedByRecipients24h);
  const vBreach = clampNonNeg(inputs.velocityBreaches60m);
  const ageDays = clampNonNeg(inputs.sessionAgeDays);

  const reasons: string[] = [];

  const fails60sPts = Math.min(f60s * 6, 30);
  if (fails60sPts > 0) {
    reasons.push(`${f60s} send failure(s) in the last minute`);
  }

  const fails60mPts = Math.min(f60m, 20);
  if (fails60mPts > 0) {
    reasons.push(`${f60m} send failure(s) in the last hour`);
  }

  const blocksPts = Math.min(blocks * 10, 30);
  if (blocksPts > 0) {
    reasons.push(`${blocks} recipient(s) blocked you in the last 24h`);
  }

  const velocityPts = Math.min(vBreach * 4, 15);
  if (velocityPts > 0) {
    reasons.push(`${vBreach} velocity-guard breach(es) in the last hour`);
  }

  // Negative contributor — older sessions are statistically safer.
  let ageBonus = 0;
  if (ageDays >= 90) ageBonus = -10;
  else if (ageDays >= 30) ageBonus = -5;

  const raw = fails60sPts + fails60mPts + blocksPts + velocityPts + ageBonus;
  const value = Math.max(0, Math.min(100, raw));

  let level: RiskLevel;
  if (value <= 24) level = 'healthy';
  else if (value <= 49) level = 'caution';
  else if (value <= 74) level = 'elevated';
  else level = 'critical';

  return { value, level, reasons };
}

// ── Redis-backed counters ───────────────────────────────────────────────
//
// The send pipeline calls these on each failure / block event; the
// counters auto-expire at their respective windows so we don't have to
// run a cleanup job.

const KEY_FAILS = (sessionId: string, window: '60s' | '60m'): string =>
  `sabwa:risk:${sessionId}:fails:${window}`;
const KEY_BLOCKS_24H = (sessionId: string): string =>
  `sabwa:risk:${sessionId}:blocked24h`;
const KEY_VELOCITY_60M = (sessionId: string): string =>
  `sabwa:risk:${sessionId}:velocity60m`;

const TTL_60S = 60;
const TTL_60M = 60 * 60;
const TTL_24H = 24 * 60 * 60;

/** A send was rejected by WhatsApp (non-network). Bumps both fail counters. */
export async function recordSendFailure(
  redis: RedisHandles,
  sessionId: string,
): Promise<void> {
  await bumpWithTtl(redis, KEY_FAILS(sessionId, '60s'), TTL_60S);
  await bumpWithTtl(redis, KEY_FAILS(sessionId, '60m'), TTL_60M);
}

/** A recipient just blocked the session. Bumps the 24h block counter. */
export async function recordBlockedBy(
  redis: RedisHandles,
  sessionId: string,
): Promise<void> {
  await bumpWithTtl(redis, KEY_BLOCKS_24H(sessionId), TTL_24H);
}

/** A `checkAndDecrement` returned `minute_cap`. Bumps the velocity counter. */
export async function recordVelocityBreach(
  redis: RedisHandles,
  sessionId: string,
): Promise<void> {
  await bumpWithTtl(redis, KEY_VELOCITY_60M(sessionId), TTL_60M);
}

/**
 * Read all counters from Redis for `sessionId` and compute the gauge.
 * `sessionAgeDays` is supplied by the caller (it lives in Mongo, not
 * Redis) so this function stays Redis-only.
 */
export async function compose(
  redis: RedisHandles,
  sessionId: string,
  sessionAgeDays: number,
): Promise<RiskScore> {
  const client = redis.client;
  const [f60s, f60m, blocks, vBreach] = await Promise.all([
    client.get(KEY_FAILS(sessionId, '60s')),
    client.get(KEY_FAILS(sessionId, '60m')),
    client.get(KEY_BLOCKS_24H(sessionId)),
    client.get(KEY_VELOCITY_60M(sessionId)),
  ]);
  return compute({
    fails60s: parseCount(f60s),
    fails60m: parseCount(f60m),
    blockedByRecipients24h: parseCount(blocks),
    velocityBreaches60m: parseCount(vBreach),
    sessionAgeDays,
  });
}

function clampNonNeg(n: number): number {
  if (!Number.isFinite(n) || n < 0) return 0;
  return n;
}

function parseCount(raw: string | null): number {
  if (!raw) return 0;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : 0;
}

async function bumpWithTtl(
  redis: RedisHandles,
  key: string,
  ttlSeconds: number,
): Promise<void> {
  const v = await redis.client.incr(key);
  if (v === 1) {
    await redis.client.expire(key, ttlSeconds);
  }
}
