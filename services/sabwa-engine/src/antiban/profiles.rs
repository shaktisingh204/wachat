//! Rate-limit *profiles* for a SabWa session.
//!
//! Profiles are intentionally coarse — the user picks one of three named
//! presets, and the limiter ([`super::rate_limit::Limiter`]) and warmup
//! ramp ([`super::warmup::Warmup`]) read the resulting [`ProfileConfig`].
//!
//! Numbers come straight from SABWA_PLAN.md §9.1:
//!
//! | Profile     | Per minute | Jitter (sec) | Per day  |
//! |-------------|-----------:|:------------:|---------:|
//! | `Safe`      |          8 |   ±4         |      500 |
//! | `Normal`    |         15 |   ±3         |    2 000 |
//! | `Aggressive`|         30 |   ±2         |   10 000 |
//!
//! The `±` value is interpreted by the limiter as a symmetric jitter
//! window: `[max(0, mean - n), mean + n]` seconds of delay before the
//! next send. We expose it as separate `jitter_sec_min` / `jitter_sec_max`
//! so the limiter doesn't have to know about the convention.

use serde::{Deserialize, Serialize};

/// Named sending personality for a session.
///
/// Cloning is cheap (it's a 1-byte enum) so the limiter / warmup take it
/// by value rather than by reference.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RateProfile {
    /// 8/min, ±4s jitter, 500/day — recommended for new or warmed-up
    /// sessions on a non-business number.
    Safe,
    /// 15/min, ±3s jitter, 2 000/day — the default once warmup completes.
    Normal,
    /// 30/min, ±2s jitter, 10 000/day — opt-in, shown with a warning;
    /// "fast lane" for users who accept the elevated ban risk.
    Aggressive,
}

/// Concrete numeric envelope a profile expands to.
///
/// Held by value; the limiter copies it on each `check()` call.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub struct ProfileConfig {
    /// Maximum messages sent inside a rolling 60-second window.
    pub per_min: u32,
    /// Lower bound of the random inter-send delay, in **seconds**.
    pub jitter_sec_min: u32,
    /// Upper bound (inclusive) of the random inter-send delay, in
    /// **seconds**.
    pub jitter_sec_max: u32,
    /// Hard daily cap; once reached the limiter returns
    /// [`super::rate_limit::LimiterDecision::BlockedDaily`].
    pub per_day: u32,
}

impl RateProfile {
    /// Returns the numeric envelope for this profile.
    ///
    /// The mapping is `const`-friendly (no allocation), so this can be
    /// called freely on every send.
    pub fn config(&self) -> ProfileConfig {
        match self {
            // Safe: mean ~6s spacing, ±4s window → [2..10] seconds.
            RateProfile::Safe => ProfileConfig {
                per_min: 8,
                jitter_sec_min: 2,
                jitter_sec_max: 10,
                per_day: 500,
            },
            // Normal: mean ~4s spacing, ±3s → [1..7] seconds.
            RateProfile::Normal => ProfileConfig {
                per_min: 15,
                jitter_sec_min: 1,
                jitter_sec_max: 7,
                per_day: 2_000,
            },
            // Aggressive: mean ~2s spacing, ±2s → [1..4] seconds (clamped
            // so we never burst with zero delay).
            RateProfile::Aggressive => ProfileConfig {
                per_min: 30,
                jitter_sec_min: 1,
                jitter_sec_max: 4,
                per_day: 10_000,
            },
        }
    }
}

impl Default for RateProfile {
    /// Sessions default to `Normal` once warmup completes; see
    /// SABWA_PLAN.md §9.2.
    fn default() -> Self {
        RateProfile::Normal
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn safe_matches_plan() {
        let c = RateProfile::Safe.config();
        assert_eq!(c.per_min, 8);
        assert_eq!(c.per_day, 500);
        assert!(c.jitter_sec_min < c.jitter_sec_max);
    }

    #[test]
    fn normal_matches_plan() {
        let c = RateProfile::Normal.config();
        assert_eq!(c.per_min, 15);
        assert_eq!(c.per_day, 2_000);
    }

    #[test]
    fn aggressive_matches_plan() {
        let c = RateProfile::Aggressive.config();
        assert_eq!(c.per_min, 30);
        assert_eq!(c.per_day, 10_000);
    }

    #[test]
    fn jitter_window_is_never_inverted() {
        for p in [RateProfile::Safe, RateProfile::Normal, RateProfile::Aggressive] {
            let c = p.config();
            assert!(c.jitter_sec_min <= c.jitter_sec_max, "{p:?}");
            assert!(c.jitter_sec_min >= 1, "{p:?} jitter must never be 0");
        }
    }
}
