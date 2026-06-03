//! §12.1 Subscriptions & Recurring billing.
//!
//! Mongo collection: `crm_subscriptions`. A subscription is a long-lived
//! billing agreement that emits invoices on a cadence (`frequency`) until
//! it is paused, cancelled, or expires. The struct captures the plan,
//! the line items charged each cycle, the dunning ladder used when a
//! generated invoice goes past-due, and a self-contained event history
//! so renewals / pauses / cancellations are auditable in one place.
//!
//! Spec verbatim: Plan, frequency, billing cycle, trial period, renewal
//! mode (auto/manual), customer, items[], proration rules, dunning
//! ladder, cancellations, pause/resume, status, next-billing-at, history.

use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use crm_core::{Audit, Identity};
use serde::{Deserialize, Serialize};

/// Cadence at which the subscription generates invoices. `Custom` is a
/// placeholder for future non-fixed cycles (e.g. usage-bucketed billing
/// driven by an external schedule).
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum BillingFrequency {
    Daily,
    Weekly,
    #[default]
    Monthly,
    Quarterly,
    Yearly,
    Custom,
}

/// Whether the subscription auto-renews at cycle end or waits for an
/// operator to confirm. `Manual` mode flips status into `Expired` once
/// the current cycle closes without confirmation.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum RenewalMode {
    #[default]
    Auto,
    Manual,
}

/// Lifecycle status. Multi-word variants serialize as snake_case
/// (`past_due`) to match the §0 enum convention; single-word variants
/// stay lowercase.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Default, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SubscriptionStatus {
    #[default]
    Trial,
    Active,
    PastDue,
    Paused,
    Cancelled,
    Expired,
}

/// One billable line on the recurring invoice. `item_id` references the
/// products/services catalog; `qty` and `rate` are denormalized so a
/// future price change to the catalog doesn't silently change the
/// customer's bill.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionItem {
    pub item_id: ObjectId,
    pub qty: f64,
    pub rate: f64,
    pub currency: String,
}

/// A single rung in the dunning ladder. The collections worker fires
/// `action` against the past-due invoice once `day_offset` days have
/// elapsed since the due date. `template_id` resolves into the message
/// templates collection per channel.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DunningStep {
    /// Days after the invoice due date when this step fires. May be
    /// negative for pre-due reminders ("3 days before due").
    pub day_offset: i32,
    /// Channel / action to perform: `"email"`, `"whatsapp"`, `"sms"`,
    /// or `"suspend"` (terminal — flips status to `past_due` lockout).
    pub action: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub template_id: Option<ObjectId>,
}

/// One entry in the subscription's audit history. Captured on every
/// status transition (trial-end, renewal, pause, resume, cancel,
/// dunning-step-fired) so the timeline is queryable without joining
/// the global audit-log.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionEvent {
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub at: DateTime<Utc>,
    /// Free-form event tag (e.g. `"renewed"`, `"paused"`, `"resumed"`,
    /// `"cancelled"`, `"dunning_email"`, `"trial_ended"`).
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub by: Option<ObjectId>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub note: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    /* ----- crm-core fragments (flattened) ------------------------ */
    #[serde(flatten)]
    pub identity: Identity,
    #[serde(flatten)]
    pub audit: Audit,

    /* ----- plan + customer --------------------------------------- */
    /// FK into a billing-plan catalog. `None` for ad-hoc subscriptions
    /// where the line items are bespoke and not driven by a packaged
    /// plan.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_id: Option<ObjectId>,
    pub customer_id: ObjectId,

    /* ----- cadence + trial --------------------------------------- */
    pub frequency: BillingFrequency,
    /// While `now < trial_until`, no invoice is generated. Status flips
    /// from `Trial` to `Active` on the first post-trial cycle.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub trial_until: Option<DateTime<Utc>>,
    pub renewal_mode: RenewalMode,

    /* ----- line items + billing rules ---------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub items: Vec<SubscriptionItem>,
    /// When `true`, mid-cycle plan / qty changes generate a prorated
    /// adjustment line on the next invoice. When `false`, changes apply
    /// at the next cycle boundary instead.
    #[serde(default)]
    pub proration_enabled: bool,

    /* ----- collections ------------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub dunning_ladder: Vec<DunningStep>,

    /* ----- lifecycle --------------------------------------------- */
    pub status: SubscriptionStatus,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub started_at: DateTime<Utc>,
    /// Time at which the next invoice should be generated. Engine
    /// advances this on each successful renewal.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub next_billing_at: Option<DateTime<Utc>>,
    /// Resume the subscription automatically once `now >= paused_until`.
    /// `None` while in `Paused` status means an indefinite pause.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub paused_until: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub cancelled_at: Option<DateTime<Utc>>,

    /* ----- audit history ----------------------------------------- */
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub history: Vec<SubscriptionEvent>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use chrono::Utc;

    #[test]
    fn round_trips_with_flattened_fragments() {
        let now = Utc::now();
        let sub = Subscription {
            identity: Identity {
                id: ObjectId::new(),
                project_id: ObjectId::new(),
                user_id: ObjectId::new(),
                tenant_id: None,
            },
            audit: Audit::new(None),
            plan_id: Some(ObjectId::new()),
            customer_id: ObjectId::new(),
            frequency: BillingFrequency::Monthly,
            trial_until: Some(now),
            renewal_mode: RenewalMode::Auto,
            items: vec![SubscriptionItem {
                item_id: ObjectId::new(),
                qty: 1.0,
                rate: 999.0,
                currency: "INR".into(),
            }],
            proration_enabled: true,
            dunning_ladder: vec![DunningStep {
                day_offset: 3,
                action: "email".into(),
                template_id: None,
            }],
            status: SubscriptionStatus::PastDue,
            started_at: now,
            next_billing_at: Some(now),
            paused_until: None,
            cancelled_at: None,
            history: vec![SubscriptionEvent {
                at: now,
                kind: "renewed".into(),
                by: None,
                note: Some("auto".into()),
            }],
        };

        let json = serde_json::to_value(&sub).unwrap();

        // crm-core::Identity flattens to root.
        assert!(json.get("identity").is_none(), "Identity must flatten");
        assert!(json.get("_id").is_some());
        assert!(json.get("projectId").is_some());
        assert!(json.get("userId").is_some());
        // crm-core::Audit flattens to root.
        assert!(json.get("audit").is_none(), "Audit must flatten");
        assert!(json.get("createdAt").is_some());
        assert!(json.get("updatedAt").is_some());

        // camelCase entity fields.
        assert!(json.get("planId").is_some());
        assert!(json.get("customerId").is_some());
        assert!(json.get("trialUntil").is_some());
        assert!(json.get("renewalMode").is_some());
        assert!(json.get("prorationEnabled").is_some());
        assert!(json.get("dunningLadder").is_some());
        assert!(json.get("nextBillingAt").is_some());
        assert!(json.get("startedAt").is_some());

        // Enum encodings: lowercase singles, snake_case multi-word.
        assert_eq!(
            json.get("frequency").and_then(|v| v.as_str()),
            Some("monthly")
        );
        assert_eq!(
            json.get("renewalMode").and_then(|v| v.as_str()),
            Some("auto")
        );
        assert_eq!(
            json.get("status").and_then(|v| v.as_str()),
            Some("past_due")
        );

        // Round-trip back.
        let back: Subscription = serde_json::from_value(json).unwrap();
        assert!(matches!(back.status, SubscriptionStatus::PastDue));
        assert!(matches!(back.frequency, BillingFrequency::Monthly));
        assert_eq!(back.items.len(), 1);
        assert_eq!(back.items[0].rate, 999.0);
    }
}
