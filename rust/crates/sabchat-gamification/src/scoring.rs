//! Pure point-formula helpers for the SabChat gamification surface.
//!
//! The conversation-status / SLA-policy vocabulary referenced below is
//! defined in [`sabchat_types`] (`ConversationStatus::Resolved`,
//! `SlaPolicy::breached`); this module assumes the recompute aggregator
//! has already filtered conversations on `status == "resolved"` and
//! read `sla.breached` from the document.

// Re-export keeps the dependency on the domain DTO crate live — the
// status / SLA vocabulary modelled here matches `sabchat_types`.
#[allow(unused_imports)]
use sabchat_types::ConversationStatus as _;

//!
//! Lives in its own module so the rule set is reviewed in one place and
//! the tiny inline unit tests below can pin the contract without
//! touching Mongo.
//!
//! ## Formula
//!
//! Per resolved conversation:
//!
//! - `+10` per resolved conversation
//! - `+5`  if the conversation's CSAT score is exactly `5/5`
//! - `+3`  if the CSAT score is exactly `4/5`
//! - `-5`  if the conversation breached its SLA
//!
//! Lower CSAT scores (1–3) do not add or subtract points — they only
//! affect the CSAT average surfaced separately on the leaderboard.

/// Snapshot of the per-conversation signals that drive the point
/// formula. Built by the [`crate::handlers::recompute`] aggregator from
/// the joined `sabchat_conversations` + `sabchat_survey_responses`
/// rows.
#[derive(Debug, Clone, Copy, Default, PartialEq, Eq)]
pub(crate) struct ConversationOutcome {
    /// CSAT score on the 1-5 scale, if a survey response exists.
    pub csat_score: Option<u8>,
    /// `true` when any SLA clock on the conversation breached.
    pub sla_breached: bool,
}

/// Compute the point delta for a single resolved conversation. Always
/// includes the `+10` resolution credit.
///
/// The result is `i64` so SLA-breach penalties can drive a single
/// conversation negative (e.g. `+10 − 5 = 5`; a no-CSAT breach is
/// `+10 − 5 = 5`).
pub(crate) fn points_for_conversation(outcome: ConversationOutcome) -> i64 {
    let mut points: i64 = 10; // resolution credit

    points += match outcome.csat_score {
        Some(5) => 5,
        Some(4) => 3,
        _ => 0,
    };

    if outcome.sla_breached {
        points -= 5;
    }

    points
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn baseline_resolution_is_ten() {
        let out = ConversationOutcome::default();
        assert_eq!(points_for_conversation(out), 10);
    }

    #[test]
    fn csat_five_adds_bonus() {
        let out = ConversationOutcome {
            csat_score: Some(5),
            sla_breached: false,
        };
        assert_eq!(points_for_conversation(out), 15);
    }

    #[test]
    fn csat_four_adds_smaller_bonus() {
        let out = ConversationOutcome {
            csat_score: Some(4),
            sla_breached: false,
        };
        assert_eq!(points_for_conversation(out), 13);
    }

    #[test]
    fn csat_three_or_below_no_bonus() {
        for s in [1_u8, 2, 3] {
            let out = ConversationOutcome {
                csat_score: Some(s),
                sla_breached: false,
            };
            assert_eq!(points_for_conversation(out), 10, "score={s}");
        }
    }

    #[test]
    fn sla_breach_subtracts_five() {
        let out = ConversationOutcome {
            csat_score: None,
            sla_breached: true,
        };
        assert_eq!(points_for_conversation(out), 5);
    }

    #[test]
    fn breach_plus_csat_five_nets_ten() {
        let out = ConversationOutcome {
            csat_score: Some(5),
            sla_breached: true,
        };
        assert_eq!(points_for_conversation(out), 10);
    }
}
