//! Ban-risk scoring.
//!
//! Implements the "ban-signal collector + risk gauge" called out in
//! SABWA_PLAN.md §9.6. The function is intentionally **pure** so it can
//! be called from anywhere (scheduler tick, REST endpoint that powers
//! the Overview gauge, even unit tests) without dragging in Redis or
//! Mongo.
//!
//! ## Weighting model
//!
//! The score is a clamped weighted sum of five normalised signals. Each
//! signal contributes a *capped* number of "risk points"; we cap rather
//! than allow unbounded growth so a single very bad metric can't pin
//! the score to 100 by itself — we want the gauge to actually reflect
//! "how many things are wrong at once".
//!
//! | Signal                          | Multiplier | Cap | Rationale |
//! |---------------------------------|-----------:|----:|-----------|
//! | `fails_60s`                     |        6×  | 30  | Hard, immediate signal — WA rejecting *right now*. |
//! | `fails_60m`                     |        1×  | 20  | Medium-term trend; smoothed over an hour. |
//! | `blocked_by_recipients_24h`     |       10×  | 30  | Strongest single ban predictor (per Baileys/WA reports). |
//! | `velocity_breaches_60m`         |        4×  | 15  | User repeatedly hitting their own per-min cap → bursty pattern. |
//! | session-age bonus               |        —   | -10 | **Subtracts** up to 10 points for sessions ≥30 days old. |
//!
//! Raw sum is clamped to `0..=100`, then bucketed:
//!
//! - `0..=24`  → [`RiskLevel::Healthy`]
//! - `25..=49` → [`RiskLevel::Caution`]
//! - `50..=74` → [`RiskLevel::Elevated`]
//! - `75..=100`→ [`RiskLevel::Critical`]
//!
//! Each contributing signal that fires (cap > 0 contribution) appends a
//! human-readable string to `reasons`, so the UI can render the gauge
//! tooltip without re-deriving anything.

use serde::{Deserialize, Serialize};

/// Inputs to the risk model. All counts are non-negative — caller is
/// responsible for clamping if pulling from a signed source.
#[derive(Debug, Clone, Copy, Default, Serialize, Deserialize)]
pub struct RiskInputs {
    /// Send-failures (non-network) observed in the last 60 seconds.
    pub fails_60s: u32,
    /// Send-failures observed in the last 60 minutes.
    pub fails_60m: u32,
    /// Distinct recipients that blocked the user in the last 24 hours.
    pub blocked_by_recipients_24h: u32,
    /// Number of times the per-minute velocity guard tripped in the
    /// last 60 minutes (i.e. user *tried* to send faster than profile).
    pub velocity_breaches_60m: u32,
    /// Age of the WhatsApp session in days. Older sessions are
    /// statistically less likely to get banned; we use this as a small
    /// downward bias.
    pub session_age_days: u32,
}

/// Discrete buckets the gauge UI renders.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Healthy,
    Caution,
    Elevated,
    Critical,
}

/// Computed score for a single session.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RiskScore {
    /// Clamped 0..=100. Higher = worse.
    pub value: u8,
    /// Bucketed level derived from `value`.
    pub level: RiskLevel,
    /// Human-readable list of which signals contributed, in the order
    /// they were evaluated. Empty on a fully-healthy session.
    pub reasons: Vec<String>,
}

/// Pure scoring function — see module docs for the weighting model.
pub fn compute(inputs: &RiskInputs) -> RiskScore {
    let mut reasons: Vec<String> = Vec::new();

    // ---- positive contributors --------------------------------------

    // We compute every contribution in u32 first, *then* `min` it
    // against the cap, *then* widen to i32. This order matters:
    // saturating_mul returns `u32::MAX` on overflow, and casting that
    // directly to `i32` would wrap to `-1` and silently zero the score.
    let fails_60s_pts = inputs.fails_60s.saturating_mul(6).min(30) as i32;
    if fails_60s_pts > 0 {
        reasons.push(format!(
            "{} send failure(s) in the last minute",
            inputs.fails_60s
        ));
    }

    let fails_60m_pts = inputs.fails_60m.min(20) as i32;
    if fails_60m_pts > 0 {
        reasons.push(format!(
            "{} send failure(s) in the last hour",
            inputs.fails_60m
        ));
    }

    let blocks_pts = inputs.blocked_by_recipients_24h.saturating_mul(10).min(30) as i32;
    if blocks_pts > 0 {
        reasons.push(format!(
            "{} recipient(s) blocked you in the last 24h",
            inputs.blocked_by_recipients_24h
        ));
    }

    let velocity_pts = inputs.velocity_breaches_60m.saturating_mul(4).min(15) as i32;
    if velocity_pts > 0 {
        reasons.push(format!(
            "{} velocity-guard breach(es) in the last hour",
            inputs.velocity_breaches_60m
        ));
    }

    // ---- negative contributor (age bonus) ---------------------------
    //
    // 0..29 days: 0 bonus. 30..89 days: -5. >=90 days: -10.
    let age_bonus = if inputs.session_age_days >= 90 {
        -10
    } else if inputs.session_age_days >= 30 {
        -5
    } else {
        0
    };

    let raw = fails_60s_pts + fails_60m_pts + blocks_pts + velocity_pts + age_bonus;
    let value = raw.clamp(0, 100) as u8;

    let level = match value {
        0..=24 => RiskLevel::Healthy,
        25..=49 => RiskLevel::Caution,
        50..=74 => RiskLevel::Elevated,
        _ => RiskLevel::Critical,
    };

    RiskScore {
        value,
        level,
        reasons,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn zero_inputs_is_healthy() {
        let s = compute(&RiskInputs::default());
        assert_eq!(s.value, 0);
        assert_eq!(s.level, RiskLevel::Healthy);
        assert!(s.reasons.is_empty());
    }

    #[test]
    fn single_block_is_caution() {
        let s = compute(&RiskInputs {
            blocked_by_recipients_24h: 1,
            ..Default::default()
        });
        // 1 block * 10 = 10 → Healthy still.
        assert_eq!(s.value, 10);
        assert_eq!(s.level, RiskLevel::Healthy);
        assert_eq!(s.reasons.len(), 1);
    }

    #[test]
    fn three_blocks_hits_caution() {
        let s = compute(&RiskInputs {
            blocked_by_recipients_24h: 3,
            ..Default::default()
        });
        // 3 * 10 = 30 → Caution.
        assert_eq!(s.value, 30);
        assert_eq!(s.level, RiskLevel::Caution);
    }

    #[test]
    fn blocks_are_capped_at_30() {
        let s = compute(&RiskInputs {
            blocked_by_recipients_24h: 99,
            ..Default::default()
        });
        assert_eq!(s.value, 30);
    }

    #[test]
    fn multiple_signals_compose() {
        let s = compute(&RiskInputs {
            fails_60s: 5,            // 5*6=30 (cap 30)
            fails_60m: 30,           // cap 20
            blocked_by_recipients_24h: 4, // 4*10=40 cap 30
            velocity_breaches_60m: 10, // 10*4=40 cap 15
            session_age_days: 0,
        });
        // 30 + 20 + 30 + 15 = 95
        assert_eq!(s.value, 95);
        assert_eq!(s.level, RiskLevel::Critical);
        assert_eq!(s.reasons.len(), 4);
    }

    #[test]
    fn old_session_gets_age_discount() {
        let young = compute(&RiskInputs {
            fails_60m: 20,
            ..Default::default()
        });
        let old = compute(&RiskInputs {
            fails_60m: 20,
            session_age_days: 120,
            ..Default::default()
        });
        assert_eq!(young.value, 20);
        assert_eq!(old.value, 10); // 20 - 10
    }

    #[test]
    fn age_discount_never_underflows() {
        let s = compute(&RiskInputs {
            session_age_days: 365,
            ..Default::default()
        });
        // No positive signals; -10 must clamp to 0, not wrap.
        assert_eq!(s.value, 0);
        assert_eq!(s.level, RiskLevel::Healthy);
    }

    #[test]
    fn score_is_clamped_to_100() {
        let s = compute(&RiskInputs {
            fails_60s: u32::MAX,
            fails_60m: u32::MAX,
            blocked_by_recipients_24h: u32::MAX,
            velocity_breaches_60m: u32::MAX,
            session_age_days: 0,
        });
        assert!(s.value <= 100);
        assert_eq!(s.level, RiskLevel::Critical);
    }

    #[test]
    fn level_boundaries() {
        // Synthetic constructions hitting each boundary.
        let healthy = compute(&RiskInputs {
            blocked_by_recipients_24h: 2, // 20
            ..Default::default()
        });
        assert_eq!(healthy.level, RiskLevel::Healthy);

        let caution = compute(&RiskInputs {
            blocked_by_recipients_24h: 3, // 30
            ..Default::default()
        });
        assert_eq!(caution.level, RiskLevel::Caution);

        let elevated = compute(&RiskInputs {
            fails_60s: 5,                  // 30
            blocked_by_recipients_24h: 2,  // 20
            ..Default::default()
        });
        // 30 + 20 = 50 → Elevated.
        assert_eq!(elevated.value, 50);
        assert_eq!(elevated.level, RiskLevel::Elevated);

        let critical = compute(&RiskInputs {
            fails_60s: 5,                  // 30
            blocked_by_recipients_24h: 5,  // 30 cap
            velocity_breaches_60m: 5,      // 20 → 15 cap
            ..Default::default()
        });
        // 30 + 30 + 15 = 75 → Critical.
        assert_eq!(critical.value, 75);
        assert_eq!(critical.level, RiskLevel::Critical);
    }
}
