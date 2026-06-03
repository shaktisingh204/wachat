//! §12.19 NPS / Referral.
//!
//! Three top-level DTOs:
//!
//! - [`NpsSurvey`] — the survey definition (trigger event, audience,
//!   scale window, follow-up question, dispatch channels, scoring
//!   method). Stored in `crm_nps_surveys`.
//! - [`NpsResponse`] — a single recorded response (score, classification
//!   bucket, optional follow-up answer). Stored in `crm_nps_responses`.
//! - [`Referral`] — referrer→referee link with a redeemable code, a
//!   workflow status and the reward to pay out on qualification.
//!   Stored in `crm_referrals`.
//!
//! All three flatten the `crm-core` cross-cutting fragments (`Identity`,
//! `Audit`).
//!
//! Spec verbatim: NPS survey: trigger event, audience, scale, follow-up
//! question, dispatch channel, scoring, dashboard. Referral: referrer,
//! referee, code, status, reward (points/credit/cash), payout.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/* ============================================================
 * NpsSurvey
 * ============================================================ */

/// Survey configuration. The worker dispatches the survey on the
/// configured `trigger_event` (e.g. `"order_delivered"`,
/// `"ticket_resolved"`) over the `dispatch_channels` (email / WhatsApp /
/// SMS / in-app) targeting the `audience`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NpsSurvey {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// Display label for the survey.
    pub name: String,

    /// Free-form event name the worker subscribes to (e.g.
    /// `"order_delivered"`, `"ticket_resolved"`, `"contract_signed"`).
    pub trigger_event: String,

    /// Audience selector. Canonical values: `"all"`, `"customer"`,
    /// `"vendor"`, `"employee"`. Free-form so tenants can wire in
    /// segment-specific audiences.
    pub audience: String,

    /// Scale lower bound (e.g. `0`).
    pub scale_min: u8,
    /// Scale upper bound (e.g. `10`).
    pub scale_max: u8,

    /// Optional free-text follow-up shown after the score
    /// (e.g. "What's the main reason for your score?").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub follow_up_question: Option<String>,

    /// Dispatch channels. Canonical values: `"email"`, `"whatsapp"`,
    /// `"sms"`, `"in_app"`. Free-form to absorb new channels.
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub dispatch_channels: Vec<String>,

    /// Scoring method. Canonical values: `"promoter_detractor"` (NPS
    /// formula: %promoters − %detractors) and `"average"`.
    pub scoring_method: String,

    /// Optional FK into `crm_dashboards` — the live results dashboard
    /// the survey publishes to.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dashboard_id: Option<ObjectId>,

    /// Whether the survey is currently dispatching. Disabled surveys
    /// retain their historical responses.
    pub active: bool,
}

/* ============================================================
 * NpsResponse
 * ============================================================ */

/// A single recorded response. `respondent_id` is optional because some
/// channels (anonymous web link) collect responses without a logged-in
/// user; in that case the worker falls back to the dispatch token.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct NpsResponse {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// FK into the parent `NpsSurvey`.
    pub survey_id: ObjectId,

    /// FK into `crm_accounts` / `users` / `crm_vendors` depending on
    /// the survey's audience. `None` for anonymous responses.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub respondent_id: Option<ObjectId>,

    /// The score given. Range is bounded by the survey's
    /// `scale_min`..=`scale_max`.
    pub score: u8,

    /// Optional free-text answer to the survey's follow-up question.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub follow_up_answer: Option<String>,

    /// When the response was recorded (typically when the form was
    /// submitted, not when it was opened).
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub submitted_at: DateTime<Utc>,

    /// Channel the response came in on (matches one of the survey's
    /// `dispatch_channels`).
    pub channel: String,

    /// Bucket the score falls into. Canonical values for an NPS
    /// scoring method: `"promoter"` (9–10), `"passive"` (7–8),
    /// `"detractor"` (0–6). Stored on the response so dashboards
    /// don't need to re-derive it.
    pub classification: String,
}

/* ============================================================
 * Referral
 * ============================================================ */

/// Reward shape paid out when a referral qualifies. Tagged enum so the
/// JSON shape is `{ "kind": "...", ...payload }` and new reward
/// mechanics can be added without breaking older documents.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "kind", rename_all = "snake_case")]
pub enum ReferralReward {
    /// Loyalty points credited to the referrer's wallet.
    Points(u64),
    /// In-app credit (denominated in the tenant's base currency,
    /// resolved at payout time).
    Credit(f64),
    /// Cash payout in a specific currency.
    Cash { amount: f64, currency: String },
}

/// One referral link / event. The lifecycle is: a referrer shares
/// `code`, the referee signs up (status `"signed_up"`), eventually
/// hits the qualification criterion (status `"qualified"`), the
/// reward is paid out (status `"rewarded"`, `payout_at` + `payout_txn_id`
/// recorded). Unredeemed codes age into `"expired"`.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Referral {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /// FK to the user / customer who shared the link.
    pub referrer_id: ObjectId,

    /// Email captured at share-time (so we can attribute a sign-up
    /// before the referee has an `_id`).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub referee_email: Option<String>,
    /// Resolved once the referee signs up.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub referee_id: Option<ObjectId>,

    /// The redeemable code (typically the referrer's slug + a short
    /// token). Indexed for fast redemption lookup.
    pub code: String,

    /// Lifecycle. Canonical values: `"pending"`, `"signed_up"`,
    /// `"qualified"`, `"rewarded"`, `"expired"`. Free-form to absorb
    /// tenant-specific intermediate states.
    pub status: String,

    /// Reward to pay out on qualification. `None` until the campaign
    /// rules resolve which reward variant applies (some campaigns
    /// pick the variant dynamically based on referee plan tier).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub reward: Option<ReferralReward>,

    /// When the reward was paid out (set by the payout worker).
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub payout_at: Option<DateTime<Utc>>,
    /// External payout reference (loyalty txn id, ledger entry id,
    /// payout provider id) — string so any provider's id format
    /// round-trips.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub payout_txn_id: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    fn ident() -> Identity {
        Identity {
            id: ObjectId::new(),
            project_id: ObjectId::new(),
            user_id: ObjectId::new(),
            tenant_id: None,
        }
    }

    #[test]
    fn nps_survey_round_trips_with_flattened_fragments() {
        let s = NpsSurvey {
            identity: ident(),
            audit: Audit::new(None),
            name: "Post-delivery NPS".into(),
            trigger_event: "order_delivered".into(),
            audience: "customer".into(),
            scale_min: 0,
            scale_max: 10,
            follow_up_question: Some("What's the main reason for your score?".into()),
            dispatch_channels: vec!["email".into(), "whatsapp".into()],
            scoring_method: "promoter_detractor".into(),
            dashboard_id: Some(ObjectId::new()),
            active: true,
        };

        let json = serde_json::to_value(&s).unwrap();

        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("createdAt").is_some());
        assert!(json.get("triggerEvent").is_some());
        assert!(json.get("scaleMin").is_some());
        assert!(json.get("scaleMax").is_some());
        assert!(json.get("followUpQuestion").is_some());
        assert!(json.get("dispatchChannels").is_some());
        assert!(json.get("scoringMethod").is_some());
        assert!(json.get("dashboardId").is_some());

        let back: NpsSurvey = serde_json::from_value(json).unwrap();
        assert_eq!(back.trigger_event, "order_delivered");
        assert_eq!(back.scale_max, 10);
        assert_eq!(back.dispatch_channels.len(), 2);
        assert!(back.active);
    }

    #[test]
    fn nps_response_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let r = NpsResponse {
            identity: ident(),
            audit: Audit::new(None),
            survey_id: ObjectId::new(),
            respondent_id: Some(ObjectId::new()),
            score: 9,
            follow_up_answer: Some("Fast shipping, great packaging.".into()),
            submitted_at: now,
            channel: "email".into(),
            classification: "promoter".into(),
        };

        let json = serde_json::to_value(&r).unwrap();

        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("surveyId").is_some());
        assert!(json.get("respondentId").is_some());
        assert!(json.get("submittedAt").is_some());
        assert!(json.get("followUpAnswer").is_some());

        let back: NpsResponse = serde_json::from_value(json).unwrap();
        assert_eq!(back.score, 9);
        assert_eq!(back.classification, "promoter");
        assert_eq!(back.channel, "email");
    }

    #[test]
    fn referral_round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let r = Referral {
            identity: ident(),
            audit: Audit::new(None),
            referrer_id: ObjectId::new(),
            referee_email: Some("friend@example.com".into()),
            referee_id: Some(ObjectId::new()),
            code: "ASHA-9F2K".into(),
            status: "rewarded".into(),
            reward: Some(ReferralReward::Cash {
                amount: 500.0,
                currency: "INR".into(),
            }),
            payout_at: Some(now),
            payout_txn_id: Some("txn_abc123".into()),
        };

        let json = serde_json::to_value(&r).unwrap();

        assert!(json.get("identity").is_none());
        assert!(json.get("audit").is_none());
        assert!(json.get("_id").is_some());
        assert!(json.get("referrerId").is_some());
        assert!(json.get("refereeEmail").is_some());
        assert!(json.get("refereeId").is_some());
        assert!(json.get("payoutAt").is_some());
        assert!(json.get("payoutTxnId").is_some());

        // Reward serializes with `kind` discriminator in snake_case.
        let reward_kind = json
            .get("reward")
            .and_then(|v| v.get("kind"))
            .and_then(|v| v.as_str());
        assert_eq!(reward_kind, Some("cash"));
        let reward_currency = json
            .get("reward")
            .and_then(|v| v.get("currency"))
            .and_then(|v| v.as_str());
        assert_eq!(reward_currency, Some("INR"));

        let back: Referral = serde_json::from_value(json).unwrap();
        assert_eq!(back.code, "ASHA-9F2K");
        assert_eq!(back.status, "rewarded");
        match back.reward {
            Some(ReferralReward::Cash { amount, currency }) => {
                assert!((amount - 500.0).abs() < 1e-9);
                assert_eq!(currency, "INR");
            }
            other => panic!("expected ReferralReward::Cash, got {:?}", other),
        }
    }
}
