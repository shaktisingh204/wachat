//! Warmup ramp for brand-new SabWa sessions.
//!
//! From SABWA_PLAN.md §9.2:
//!
//! > **Warmup mode** — new sessions start at 5/min and ramp linearly
//! > over 7 days.
//!
//! This module exposes a pure function ([`Warmup::effective_per_min`])
//! that takes the profile's `per_min` cap and returns the *current*
//! effective cap given the session's age. The limiter
//! ([`super::rate_limit::Limiter`]) is expected to call this on every
//! `check()` if warmup is enabled, and treat the returned value as the
//! per-minute budget instead of the raw profile value.
//!
//! No I/O — `Warmup` is a value type the caller constructs from
//! whatever it has loaded from Mongo for the session.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

/// Warmup state for a single session.
///
/// `enabled = false` short-circuits to "use the raw profile cap"; this
/// lets callers carry a `Warmup` around unconditionally without
/// branching at the call site.
#[derive(Debug, Clone, Copy, Serialize, Deserialize)]
pub struct Warmup {
    /// First time this session ever connected (or the moment the user
    /// hit "Start warmup"). Used as the ramp anchor.
    pub started_at: DateTime<Utc>,
    /// Whether the ramp is active. Once 7 days elapse the limiter will
    /// also receive the raw cap, but admins can also flip this off
    /// manually (e.g. for already-warm imported sessions).
    pub enabled: bool,
}

impl Warmup {
    /// Returns the effective per-minute budget for *right now*.
    ///
    /// Curve: linear from `5` on day 0 to `base` on day 7 (inclusive),
    /// rounded to the nearest integer. After day 7 it returns `base`
    /// unchanged.
    ///
    /// Negative session ages (clock skew, future-dated `started_at`)
    /// are clamped to day 0, so we never accidentally exceed `base`.
    pub fn effective_per_min(&self, base: u32) -> u32 {
        if !self.enabled {
            return base;
        }
        let days = (Utc::now() - self.started_at).num_days().max(0);
        if days >= 7 {
            return base;
        }
        let start = 5u32;
        // If a profile is configured below the warmup floor (e.g. some
        // future ultra-safe profile), respect the lower number — we
        // never want warmup to *raise* the cap.
        if base <= start {
            return base;
        }
        let progress = days as f64 / 7.0;
        ((start as f64) + ((base as f64) - (start as f64)) * progress).round() as u32
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Duration;

    fn at_days_ago(d: i64) -> Warmup {
        Warmup {
            started_at: Utc::now() - Duration::days(d),
            enabled: true,
        }
    }

    #[test]
    fn disabled_returns_base_unchanged() {
        let w = Warmup {
            started_at: Utc::now(),
            enabled: false,
        };
        assert_eq!(w.effective_per_min(15), 15);
        assert_eq!(w.effective_per_min(30), 30);
    }

    #[test]
    fn day_zero_is_floor() {
        let w = at_days_ago(0);
        assert_eq!(w.effective_per_min(15), 5);
        assert_eq!(w.effective_per_min(30), 5);
    }

    #[test]
    fn day_seven_is_full_base() {
        let w = at_days_ago(7);
        assert_eq!(w.effective_per_min(15), 15);
        assert_eq!(w.effective_per_min(30), 30);
    }

    #[test]
    fn past_day_seven_is_full_base() {
        let w = at_days_ago(42);
        assert_eq!(w.effective_per_min(15), 15);
    }

    #[test]
    fn ramp_is_monotonic_nondecreasing() {
        let base = 30u32;
        let mut prev = 0u32;
        for d in 0..=7 {
            let v = at_days_ago(d).effective_per_min(base);
            assert!(v >= prev, "day {d}: {v} < prev {prev}");
            prev = v;
        }
    }

    #[test]
    fn future_dated_start_clamps_to_day_zero() {
        let w = Warmup {
            started_at: Utc::now() + Duration::days(3),
            enabled: true,
        };
        assert_eq!(w.effective_per_min(15), 5);
    }

    #[test]
    fn base_below_warmup_floor_is_respected() {
        // Hypothetical ultra-safe profile at 3/min: warmup must not
        // raise the cap above what the profile asked for.
        let w = at_days_ago(0);
        assert_eq!(w.effective_per_min(3), 3);
    }
}
