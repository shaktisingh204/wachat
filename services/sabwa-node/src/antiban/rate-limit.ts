/**
 * Per-session rate limiter for outbound SabWa messages.
 *
 * Implements the velocity-guard half of SABWA_PLAN.md §9 — every call to
 * `BaileysSession.send(...)` (and the `/v1/messages` send route) must pass
 * through `checkAndDecrement(...)` before actually dispatching to the
 * WhatsApp socket. The function is a *single round-trip* token-bucket
 * decrement: it returns either an `ok` decision (with an optional jitter
 * sleep) and credit is already consumed, or it returns `ok: false` with a
 * machine-readable reason so the caller can pause the campaign.
 *
 * Ported from `services/sabwa-engine/src/antiban/rate_limit.rs`, but the
 * Rust split of `check` + `record_send` is collapsed here per the
 * Node.js spec — callers want a single atomic gate.
 *
 * ## Redis key layout
 *
 *   sabwa:rate:{sessionId}:minute   INCR-per-send, TTL 90s
 *   sabwa:rate:{sessionId}:day      INCR-per-send, TTL 86400s
 *
 * We use the static key names (no time suffix) and rely on TTLs to roll
 * the windows: the per-minute key is born with a 90s TTL on first write
 * and dies before the next minute can land outside its bucket, the
 * per-day key with 86400s.
 *
 * The decrement is conservative: we INCR first, then check against the
 * cap, then DECR-back if we exceeded. This avoids a race where two
 * concurrent senders both see `count < cap` and both proceed.
 */

import type { RedisHandles } from '../db/redis.js';
import { profileConfig, sampleJitterMs, type RateProfile } from './profiles.js';

/**
 * Outcome of a single `checkAndDecrement` call.
 *
 * On `ok: true`, the call already consumed one unit of budget from both
 * the per-minute and per-day buckets. `sleepMs` is the jitter delay the
 * caller MUST honour (with `await new Promise(r => setTimeout(r, ms))`)
 * before dispatching the actual send.
 *
 * On `ok: false`, no budget was consumed and the caller must NOT send.
 * `reason` distinguishes a soft pause (minute roll-over coming) from a
 * hard pause (daily cap, no retry helps until UTC midnight).
 */
export type RateLimitDecision =
  | { ok: true; sleepMs: number }
  | { ok: false; reason: 'minute_cap' | 'day_cap' };

/** Effective caps for one call. Allows the warmup ramp to override `perMinute`. */
export interface RateLimitCaps {
  /** Effective per-minute cap (post-warmup). Defaults to the profile value. */
  perMinute?: number;
  /** Effective per-day cap. Defaults to the profile value. */
  perDay?: number;
}

const MIN_KEY = (sessionId: string): string => `sabwa:rate:${sessionId}:minute`;
const DAY_KEY = (sessionId: string): string => `sabwa:rate:${sessionId}:day`;

const MIN_TTL_SECONDS = 90;
const DAY_TTL_SECONDS = 86_400;

/**
 * Atomically check the per-minute and per-day buckets, consume one unit
 * if both have headroom, and return the decision. Safe to call from
 * multiple concurrent senders against the same session.
 *
 * @param redis  Shared Redis handles (uses `client`, never `pub`/`sub`).
 * @param sessionId  The `sabwa_sessions._id` (stringified ObjectId).
 * @param profile  The session's configured `RateProfile`.
 * @param caps  Optional overrides (e.g. warmup's effective per-minute).
 */
export async function checkAndDecrement(
  redis: RedisHandles,
  sessionId: string,
  profile: RateProfile,
  caps: RateLimitCaps = {},
): Promise<RateLimitDecision> {
  const cfg = profileConfig(profile);
  const perMinute = caps.perMinute ?? cfg.perMinute;
  const perDay = caps.perDay ?? cfg.perDay;

  const minKey = MIN_KEY(sessionId);
  const dayKey = DAY_KEY(sessionId);

  const client = redis.client;

  // 1) Daily check first — a hard cap is "stickier" than the minute roll-over,
  // and we want to surface `day_cap` even if the minute bucket happens to be
  // empty. INCR + EXPIRE-on-first-write is the canonical Redis pattern.
  const dayNew = await client.incr(dayKey);
  if (dayNew === 1) {
    await client.expire(dayKey, DAY_TTL_SECONDS);
  }
  if (dayNew > perDay) {
    // Roll back the speculative INCR so the counter remains an accurate
    // count of *actual* sends — important for the daily-cap UI.
    await client.decr(dayKey);
    return { ok: false, reason: 'day_cap' };
  }

  // 2) Per-minute check. Same pattern; if we exceed, we DECR both buckets so
  // we don't lose budget against a soft throttle.
  const minNew = await client.incr(minKey);
  if (minNew === 1) {
    await client.expire(minKey, MIN_TTL_SECONDS);
  }
  if (minNew > perMinute) {
    await client.decr(minKey);
    await client.decr(dayKey);
    return { ok: false, reason: 'minute_cap' };
  }

  // 3) Both buckets accepted the credit — sample jitter and return.
  return { ok: true, sleepMs: sampleJitterMs(cfg.jitterMinMs, cfg.jitterMaxMs) };
}

/**
 * Read-only peek at the current per-minute / per-day counters for a
 * session. Used by `getStatus()` and the Overview UI; never mutates.
 */
export async function readCounters(
  redis: RedisHandles,
  sessionId: string,
): Promise<{ minute: number; day: number }> {
  const [minStr, dayStr] = await Promise.all([
    redis.client.get(MIN_KEY(sessionId)),
    redis.client.get(DAY_KEY(sessionId)),
  ]);
  const minute = minStr ? Number.parseInt(minStr, 10) : 0;
  const day = dayStr ? Number.parseInt(dayStr, 10) : 0;
  return {
    minute: Number.isFinite(minute) && minute > 0 ? minute : 0,
    day: Number.isFinite(day) && day > 0 ? day : 0,
  };
}

/**
 * Sleep helper the wire-level callers should use to honour `sleepMs`.
 * Centralised so tests can swap it for a fake clock.
 */
export function sleep(ms: number): Promise<void> {
  if (ms <= 0) return Promise.resolve();
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
