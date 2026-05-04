//! Optional replay-window helper.
//!
//! ## Important caveat
//!
//! Meta does **not** currently send a dedicated timestamp header for
//! WhatsApp webhook deliveries — there is no equivalent to Stripe's
//! `Stripe-Signature t=…`. So in the common path the receiver has
//! nothing to feed into [`ReplayGuard::check_timestamp`].
//!
//! This helper is here for the (rare) cases where the receiver derives
//! a per-delivery timestamp from the payload itself. The most common
//! source is the `entry[].time` field on `whatsapp_business_account`
//! envelopes, which Meta populates with the Unix epoch seconds at which
//! the change was emitted. Higher layers may extract that value and
//! pass it here to bound how stale a replayed body may be.
//!
//! The guard is intentionally minimal: window in, header timestamp +
//! "now" in, `Ok(())` or [`VerifyError::StaleTimestamp`] out.

use chrono::Duration;

use crate::error::VerifyError;

/// Reject deliveries whose timestamp falls outside `[now - window, now + window]`.
///
/// The symmetric window also rejects timestamps from the future, which
/// catches both clock-skew issues and trivially-forged payloads where
/// the attacker tries to make a replay look fresher than it is.
#[derive(Debug, Clone, Copy)]
pub struct ReplayGuard {
    window: Duration,
}

impl ReplayGuard {
    /// Build a guard that accepts timestamps within `±window` of "now".
    pub fn new(window: Duration) -> Self {
        Self { window }
    }

    /// Default 5-minute window. Matches the conventional value used by
    /// Stripe / Slack / GitHub webhook receivers.
    pub fn default_5_min() -> Self {
        Self::new(Duration::minutes(5))
    }

    /// Returns the configured window.
    pub fn window(&self) -> Duration {
        self.window
    }

    /// Validate `header_ts` (Unix seconds) against `now` (Unix seconds).
    ///
    /// Both are caller-supplied so this stays pure and trivially
    /// testable; production callers will pass `chrono::Utc::now().timestamp()`.
    pub fn check_timestamp(&self, header_ts: i64, now: i64) -> Result<(), VerifyError> {
        let delta = now.saturating_sub(header_ts).abs();
        // `Duration::num_seconds` is an i64; the saturating abs above
        // already guards against overflow.
        if delta > self.window.num_seconds() {
            return Err(VerifyError::StaleTimestamp);
        }
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn accepts_within_window() {
        let g = ReplayGuard::default_5_min();
        // 4 minutes old — fine.
        assert!(g.check_timestamp(1_000_000, 1_000_000 + 240).is_ok());
        // exactly on the boundary — fine.
        assert!(g.check_timestamp(1_000_000, 1_000_000 + 300).is_ok());
    }

    #[test]
    fn rejects_too_old() {
        let g = ReplayGuard::default_5_min();
        // 6 minutes old — stale.
        assert_eq!(
            g.check_timestamp(1_000_000, 1_000_000 + 360),
            Err(VerifyError::StaleTimestamp),
        );
    }

    #[test]
    fn rejects_far_future() {
        let g = ReplayGuard::default_5_min();
        assert_eq!(
            g.check_timestamp(1_000_000 + 360, 1_000_000),
            Err(VerifyError::StaleTimestamp),
        );
    }
}
