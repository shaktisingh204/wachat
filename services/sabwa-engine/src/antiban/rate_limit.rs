//! Redis-backed sliding-window rate limiter for a SabWa session.
//!
//! Implements SABWA_PLAN.md §9 items 1 + 3 (rate profiles + velocity
//! guard). The limiter exposes two operations:
//!
//! - [`Limiter::check`] — read-only, returns a [`LimiterDecision`] the
//!   caller can act on **without** consuming budget.
//! - [`Limiter::record_send`] — call **after** an actual send succeeded,
//!   bumping the per-minute and per-day counters.
//!
//! Splitting `check` and `record_send` (instead of a single
//! `acquire_or_throttle`) is deliberate: it lets the scheduler peek to
//! decide *when* to schedule the next job (`Throttle.retry_after_ms`)
//! without falsely incrementing counters for sends that never happen
//! (e.g. recipient on first-contact blocklist, presence guard tripped,
//! socket disconnected mid-flight).
//!
//! ## Redis key layout
//!
//! - `sabwa:rl:{session_id}:min:{floor_min_ts}` — INCR-ed once per send,
//!   TTL 90s. `floor_min_ts` is the unix minute (epoch seconds / 60), so
//!   keys naturally rotate every minute and we never need a ZSET.
//! - `sabwa:rl:{session_id}:day:{yyyymmdd}` — INCR-ed once per send,
//!   TTL 86 400s. Day is computed in UTC from `chrono::Utc::today`.
//!
//! Both keys use SETEX-on-first-write semantics: we INCR first, and if
//! the returned value is `1` we EXPIRE the key. This is the standard
//! Redis pattern (cheaper than `SET NX + INCR`).

use chrono::{Datelike, Utc};
use redis::AsyncCommands;
use tracing::warn;

use super::profiles::RateProfile;

/// Outcome of a single [`Limiter::check`] call.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum LimiterDecision {
    /// Send is permitted. The caller **must** sleep for `jitter_ms`
    /// milliseconds before actually dispatching the message — this is
    /// the per-message jitter from the active profile, not a throttle.
    Allow {
        /// Recommended pre-send delay in milliseconds, sampled uniformly
        /// from `[profile.jitter_sec_min, profile.jitter_sec_max] * 1000`.
        jitter_ms: u32,
    },
    /// The per-minute window is saturated. Try again in `retry_after_ms`.
    /// This is the velocity-guard branch from SABWA_PLAN §9.3.
    Throttle {
        /// Milliseconds until the current minute bucket rolls over.
        retry_after_ms: u64,
    },
    /// Hard daily cap reached. No retry will help until UTC midnight.
    BlockedDaily,
}

/// Per-session limiter. Cheap to construct on every call — it borrows
/// the Redis client and the session id, and the `profile` is a 1-byte
/// enum.
pub struct Limiter<'a> {
    pub redis: &'a redis::Client,
    pub session_id: &'a str,
    pub profile: RateProfile,
}

impl<'a> Limiter<'a> {
    /// Read both counters and decide whether to allow, throttle, or
    /// block. Does **not** consume budget.
    pub async fn check(&self) -> anyhow::Result<LimiterDecision> {
        let cfg = self.profile.config();
        let mut conn = self.redis.get_multiplexed_async_connection().await?;

        let now = Utc::now();
        let now_secs = now.timestamp().max(0) as u64;
        let floor_min_ts = now_secs / 60;
        let secs_into_minute = now_secs % 60;
        let yyyymmdd = format!("{:04}{:02}{:02}", now.year(), now.month(), now.day());

        let min_key = min_key(self.session_id, floor_min_ts);
        let day_key = day_key(self.session_id, &yyyymmdd);

        // Read both counters. Missing key → 0.
        let min_count: u32 = conn.get(&min_key).await.unwrap_or(0);
        let day_count: u32 = conn.get(&day_key).await.unwrap_or(0);

        if day_count >= cfg.per_day {
            return Ok(LimiterDecision::BlockedDaily);
        }
        if min_count >= cfg.per_min {
            // Roll over at the top of the next minute. We add 1ms of
            // slack so the next `check` lands in the new bucket.
            let retry_after_ms = (60u64.saturating_sub(secs_into_minute)) * 1_000 + 1;
            return Ok(LimiterDecision::Throttle { retry_after_ms });
        }

        Ok(LimiterDecision::Allow {
            jitter_ms: sample_jitter_ms(cfg.jitter_sec_min, cfg.jitter_sec_max),
        })
    }

    /// Atomically increment both counters and set TTLs on first write.
    /// Call this **only after** a send was actually dispatched to the
    /// WhatsApp socket.
    pub async fn record_send(&self) -> anyhow::Result<()> {
        let mut conn = self.redis.get_multiplexed_async_connection().await?;

        let now = Utc::now();
        let now_secs = now.timestamp().max(0) as u64;
        let floor_min_ts = now_secs / 60;
        let yyyymmdd = format!("{:04}{:02}{:02}", now.year(), now.month(), now.day());

        let min_key = min_key(self.session_id, floor_min_ts);
        let day_key = day_key(self.session_id, &yyyymmdd);

        // INCR returns the new value; if it's 1 the key was just born,
        // so we set the TTL. Doing it unconditionally would reset the
        // window on every send — exactly what we don't want.
        let min_new: i64 = conn.incr(&min_key, 1i64).await?;
        if min_new == 1 {
            // 90s, not 60s — gives a generous safety margin so a key
            // that's read right at the rollover can't disappear under us.
            let _: () = conn.expire(&min_key, 90).await.unwrap_or(());
        }

        let day_new: i64 = conn.incr(&day_key, 1i64).await?;
        if day_new == 1 {
            let _: () = conn.expire(&day_key, 86_400).await.unwrap_or(());
        }

        if min_new < 0 || day_new < 0 {
            // Should never happen with INCR-from-zero, but log loudly
            // rather than silently corrupting the gauge.
            warn!(
                session = self.session_id,
                min_new, day_new, "rate-limit counter went negative"
            );
        }

        Ok(())
    }
}

fn min_key(session_id: &str, floor_min_ts: u64) -> String {
    format!("sabwa:rl:{session_id}:min:{floor_min_ts}")
}

fn day_key(session_id: &str, yyyymmdd: &str) -> String {
    format!("sabwa:rl:{session_id}:day:{yyyymmdd}")
}

/// Sample a uniform random delay in `[min_s, max_s]` seconds and return
/// it in milliseconds. We avoid pulling in the `rand` crate by hashing
/// the current nanosecond clock — good enough for jitter, this isn't
/// cryptographic and the only goal is "don't be perfectly periodic".
fn sample_jitter_ms(min_s: u32, max_s: u32) -> u32 {
    let lo = min_s.min(max_s);
    let hi = min_s.max(max_s);
    let span = hi.saturating_sub(lo).saturating_add(1);
    // Cheap xorshift-style mix over the wallclock nanos.
    let nanos = Utc::now().timestamp_subsec_nanos() as u64;
    let mut x = nanos.wrapping_mul(2862933555777941757).wrapping_add(3037000493);
    x ^= x >> 33;
    let pick = (x as u32) % span.max(1);
    (lo + pick) * 1_000
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn jitter_stays_in_window() {
        for _ in 0..200 {
            let ms = sample_jitter_ms(2, 10);
            assert!(
                (2_000..=10_000).contains(&ms),
                "jitter {ms}ms out of [2000,10000]"
            );
        }
    }

    #[test]
    fn jitter_single_point_window() {
        // min == max should always yield that exact value.
        for _ in 0..50 {
            assert_eq!(sample_jitter_ms(3, 3), 3_000);
        }
    }

    #[test]
    fn jitter_handles_inverted_input() {
        // Defensive: if a profile is misconfigured we still produce a
        // value in the (swapped) window rather than panicking.
        for _ in 0..50 {
            let ms = sample_jitter_ms(10, 2);
            assert!((2_000..=10_000).contains(&ms));
        }
    }

    #[test]
    fn key_format_is_stable() {
        assert_eq!(min_key("s1", 27_500_000), "sabwa:rl:s1:min:27500000");
        assert_eq!(day_key("s1", "20260515"), "sabwa:rl:s1:day:20260515");
    }
}
