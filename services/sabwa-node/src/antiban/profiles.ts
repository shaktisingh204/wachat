/**
 * Anti-ban *rate profiles* for a SabWa session.
 *
 * Three coarse presets users pick between for a session. The limiter
 * (`./rate-limit.ts`) and the warmup ramp (`./warmup.ts`) both read the
 * `ProfileConfig` returned by `profileConfig()` below.
 *
 *   | Profile     | Per minute | Jitter (sec) | Per day |
 *   |-------------|-----------:|:------------:|--------:|
 *   | `safe`      |          8 |   ±4         |     500 |
 *   | `normal`    |         15 |   ±3         |   2 000 |
 *   | `aggressive`|         30 |   ±2         |  10 000 |
 *
 * The `±` value is interpreted as a symmetric jitter window. We pre-bake
 * `jitterMinMs` / `jitterMaxMs` (milliseconds, never negative, never zero)
 * so the limiter doesn't have to know the convention.
 *
 * Ported from `services/sabwa-engine/src/antiban/profiles.rs`.
 */

/** Named sending personality for a session. */
export type RateProfile = 'safe' | 'normal' | 'aggressive';

/** Concrete numeric envelope a profile expands to. */
export interface ProfileConfig {
  /** Maximum messages sent inside a rolling 60-second window. */
  perMinute: number;
  /** Lower bound (inclusive) of the random inter-send delay, milliseconds. */
  jitterMinMs: number;
  /** Upper bound (inclusive) of the random inter-send delay, milliseconds. */
  jitterMaxMs: number;
  /** Hard daily cap; once reached the limiter returns `day_cap`. */
  perDay: number;
}

/**
 * Static table of profile envelopes. Values come straight from
 * SABWA_PLAN.md §9.1 and match the Rust engine 1:1.
 *
 * Jitter is expressed as `[mean - n, mean + n]` seconds, clamped so the
 * lower bound is never below 1 second (a 0-ms wait would defeat the
 * purpose of the jitter).
 */
export const PROFILES: Readonly<Record<RateProfile, ProfileConfig>> = Object.freeze({
  // safe: mean ~6s spacing, ±4s window → [2..10] seconds.
  safe: { perMinute: 8, jitterMinMs: 2_000, jitterMaxMs: 10_000, perDay: 500 },
  // normal: mean ~4s spacing, ±3s → [1..7] seconds.
  normal: { perMinute: 15, jitterMinMs: 1_000, jitterMaxMs: 7_000, perDay: 2_000 },
  // aggressive: mean ~2s spacing, ±2s → [1..4] seconds.
  aggressive: { perMinute: 30, jitterMinMs: 1_000, jitterMaxMs: 4_000, perDay: 10_000 },
});

/** Default profile assigned to a session once warmup completes. */
export const DEFAULT_PROFILE: RateProfile = 'normal';

/** Return the numeric envelope for a profile. Pure / allocation-free. */
export function profileConfig(profile: RateProfile): ProfileConfig {
  return PROFILES[profile];
}

/** Type-guard for incoming strings (e.g. from a request body). */
export function isRateProfile(v: unknown): v is RateProfile {
  return v === 'safe' || v === 'normal' || v === 'aggressive';
}

/**
 * Sample a uniform random delay in `[minMs, maxMs]` milliseconds. Pure;
 * uses `Math.random` because jitter is non-cryptographic — the only goal
 * is "don't be perfectly periodic".
 */
export function sampleJitterMs(minMs: number, maxMs: number): number {
  const lo = Math.min(minMs, maxMs);
  const hi = Math.max(minMs, maxMs);
  if (hi <= lo) return Math.max(0, Math.floor(lo));
  // Math.random() is [0, 1), so (hi - lo + 1) keeps the upper bound inclusive.
  return Math.floor(lo + Math.random() * (hi - lo + 1));
}
