/**
 * Warmup ramp for brand-new SabWa sessions.
 *
 * SABWA_PLAN.md §9.2:
 *
 *   New sessions start at 5/min and ramp linearly over 7 days, reaching
 *   the profile's full per-minute cap on day 7.
 *
 * The two persisted fields live on `sabwa_sessions`:
 *
 *   warmupEnabled    boolean  — flip to `false` for already-warm imports.
 *   warmupStartedAt  Date     — first connect time, ramp anchor.
 *
 * This module is *pure* — no I/O. The bulk worker / `/v1/messages` route
 * is expected to load those two fields from Mongo, build a `WarmupState`
 * literal, and pass it to `effectivePerMinute(...)` to get the actual
 * per-minute cap to feed to the limiter as a `RateLimitCaps.perMinute`
 * override.
 *
 * Ported from `services/sabwa-engine/src/antiban/warmup.rs`.
 */

/** Warmup configuration for a single session, as stored on `sabwa_sessions`. */
export interface WarmupState {
  /**
   * Whether the ramp is active. `false` short-circuits to "use the raw
   * profile cap"; lets callers carry a `WarmupState` around unconditionally
   * without branching at the call site.
   */
  warmupEnabled: boolean;
  /**
   * First time this session ever connected (or the moment the user hit
   * "Start warmup"). Used as the ramp anchor. May be `null` for legacy
   * sessions that predate warmup.
   */
  warmupStartedAt: Date | null;
}

/** Day-zero floor — the per-minute cap on the very first day of warmup. */
export const WARMUP_FLOOR_PER_MIN = 5;
/** Number of days over which the ramp completes. */
export const WARMUP_RAMP_DAYS = 7;

/**
 * Returns the effective per-minute budget for *right now* given a base
 * per-minute cap (from the profile) and the session's warmup state.
 *
 * Curve: linear from `WARMUP_FLOOR_PER_MIN` on day 0 to `base` on day
 * `WARMUP_RAMP_DAYS` (inclusive), rounded to the nearest integer. After
 * day 7 it returns `base` unchanged.
 *
 * Edge cases:
 *  - `warmupEnabled = false` → returns `base` unchanged.
 *  - `warmupStartedAt = null` → treated as "no ramp data, full cap".
 *  - Future-dated `warmupStartedAt` (clock skew) → clamped to day 0.
 *  - `base <= WARMUP_FLOOR_PER_MIN` (ultra-safe future profile) →
 *    returns `base` so warmup never *raises* the cap.
 *
 * @param state  Persisted warmup fields from `sabwa_sessions`.
 * @param base   Raw `perMinute` from the profile.
 * @param now    Reference time (defaults to wallclock); injectable for tests.
 */
export function effectivePerMinute(
  state: WarmupState,
  base: number,
  now: Date = new Date(),
): number {
  if (!state.warmupEnabled) return base;
  if (!state.warmupStartedAt) return base;
  if (base <= WARMUP_FLOOR_PER_MIN) return base;

  const startedMs = state.warmupStartedAt.getTime();
  const nowMs = now.getTime();
  const elapsedMs = Math.max(0, nowMs - startedMs);
  const days = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));

  if (days >= WARMUP_RAMP_DAYS) return base;

  const progress = days / WARMUP_RAMP_DAYS;
  const ramped = WARMUP_FLOOR_PER_MIN + (base - WARMUP_FLOOR_PER_MIN) * progress;
  return Math.round(ramped);
}

/**
 * Convenience: is the ramp still in progress? Useful for surfacing a
 * "warming up: day N of 7" badge on the Sessions table.
 */
export function isWarming(state: WarmupState, now: Date = new Date()): boolean {
  if (!state.warmupEnabled || !state.warmupStartedAt) return false;
  const elapsedMs = now.getTime() - state.warmupStartedAt.getTime();
  const days = Math.floor(elapsedMs / (24 * 60 * 60 * 1000));
  return days >= 0 && days < WARMUP_RAMP_DAYS;
}
