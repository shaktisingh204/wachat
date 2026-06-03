//! Wire-format request DTOs for the subscription endpoints.
//!
//! The **response** type for every read/write endpoint is the canonical
//! [`crm_extras_types::Subscription`] DTO — we deliberately do not
//! redeclare it here. The shapes below describe only what callers send
//! IN (create-input, update-input, list-query, pause-input); they are
//! intentionally narrower than the full Subscription model so the API
//! surface stays controlled.
//!
//! Field naming uses `#[serde(rename_all = "camelCase")]` so JSON
//! requests round-trip with the TS clients.

use chrono::{DateTime, Utc};
use crm_extras_types::subscription::{
    BillingFrequency, DunningStep, RenewalMode, SubscriptionItem, SubscriptionStatus,
};
use serde::{Deserialize, Serialize};

/// Default page size if the caller doesn't send `limit`.
pub const DEFAULT_LIMIT: i64 = 20;

/// Hard ceiling on a single page. Mirrors the §0 convention used across
/// the Rust BFF (clamped to keep large-result-set DoS attempts bounded).
pub const MAX_LIMIT: i64 = 100;

/// `GET /v1/crm/subscriptions` query string.
///
/// `q` is a free-text substring searched (case-insensitive) across the
/// fields most likely to identify a subscription at a glance —
/// currently the only text-bearing column is `currency` on the line
/// items, so the `q` filter is intentionally minimal: it matches against
/// the subscription's first item currency. Production callers usually
/// filter by `customer_id` or `status` instead.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// 1-indexed page. Defaults to `1`.
    #[serde(default)]
    pub page: Option<u32>,
    /// Page size. Defaults to [`DEFAULT_LIMIT`], clamped to
    /// [`MAX_LIMIT`].
    #[serde(default)]
    pub limit: Option<u32>,
    /// Free-text search (case-insensitive substring match on the first
    /// item's currency). Optional.
    #[serde(default)]
    pub q: Option<String>,
    /// Restrict to subscriptions for a single customer (24-char hex
    /// `ObjectId`).
    #[serde(default)]
    pub customer_id: Option<String>,
    /// Restrict to a single lifecycle status (`trial`, `active`,
    /// `past_due`, `paused`, `cancelled`, `expired`).
    #[serde(default)]
    pub status: Option<SubscriptionStatus>,
}

/// `POST /v1/crm/subscriptions` body. Curated subset of the full
/// [`crm_extras_types::Subscription`] surface — enough to drive the
/// "Add Subscription" UI.
///
/// **Required:** `customerId`, `frequency`, `startedAt`, `items[]`,
/// `renewalMode`.
///
/// **Optional:** `planId`, `trialUntil`, `nextBillingAt`,
/// `prorationEnabled`, `dunningLadder[]`.
///
/// **Deferred (server-managed):** `history[]`, `status` (the create
/// handler picks the initial status — `Trial` if `trialUntil` is in
/// the future, otherwise `Active`), `pausedUntil`, `cancelledAt`.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubscriptionInput {
    /* ----- identity ----- */
    /// Optional override of the project scope. When absent the create
    /// handler stamps a freshly minted `ObjectId` so the document is at
    /// least syntactically valid; production callers SHOULD send the
    /// real projectId so cross-project queries stay accurate.
    #[serde(default)]
    pub project_id: Option<String>,

    /* ----- plan + customer (★ customer required) ----- */
    /// 24-char hex of the parent customer.
    pub customer_id: String,
    /// 24-char hex of the billing-plan catalog entry. Optional — ad-hoc
    /// subscriptions leave this `null`.
    #[serde(default)]
    pub plan_id: Option<String>,

    /* ----- cadence + trial (★ frequency, started_at, renewal_mode) ----- */
    pub frequency: BillingFrequency,
    #[serde(with = "bson::serde_helpers::chrono_datetime_as_bson_datetime")]
    pub started_at: DateTime<Utc>,
    pub renewal_mode: RenewalMode,
    /// While `now < trialUntil`, no invoice is generated.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub trial_until: Option<DateTime<Utc>>,
    /// Time of the next invoice. Engine advances this on each
    /// successful renewal; callers may seed it on create.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub next_billing_at: Option<DateTime<Utc>>,

    /* ----- line items + billing rules (★ items required) ----- */
    pub items: Vec<SubscriptionItem>,
    /// When `true`, mid-cycle plan / qty changes generate a prorated
    /// adjustment line on the next invoice.
    #[serde(default)]
    pub proration_enabled: Option<bool>,

    /* ----- collections ----- */
    #[serde(default)]
    pub dunning_ladder: Option<Vec<DunningStep>>,
}

/// `PATCH /v1/crm/subscriptions/:id` body. Every field is optional;
/// only the fields explicitly sent are modified on the document. The
/// handler always refreshes `updatedAt` regardless of which fields are
/// set. Lifecycle transitions (`status`, `pausedUntil`, `cancelledAt`)
/// belong to dedicated endpoints (e.g. `POST /:id/pause`) and are not
/// editable here.
#[derive(Debug, Clone, Default, Deserialize, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubscriptionInput {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub plan_id: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub frequency: Option<BillingFrequency>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub renewal_mode: Option<RenewalMode>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub trial_until: Option<DateTime<Utc>>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        skip_serializing_if = "Option::is_none"
    )]
    pub next_billing_at: Option<DateTime<Utc>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub items: Option<Vec<SubscriptionItem>>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub proration_enabled: Option<bool>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub dunning_ladder: Option<Vec<DunningStep>>,
}

impl UpdateSubscriptionInput {
    /// `true` when no field is set — the handler short-circuits with a
    /// `BadRequest` to avoid pointless `updatedAt` churn.
    pub fn is_empty(&self) -> bool {
        self.plan_id.is_none()
            && self.frequency.is_none()
            && self.renewal_mode.is_none()
            && self.trial_until.is_none()
            && self.next_billing_at.is_none()
            && self.items.is_none()
            && self.proration_enabled.is_none()
            && self.dunning_ladder.is_none()
    }
}

/// `POST /v1/crm/subscriptions/:id/pause` body.
///
/// Both fields are optional — sending an empty `{}` pauses
/// indefinitely. `pausedUntil` schedules an automatic resume at the
/// given timestamp; the collections worker reads it. `note` is recorded
/// on the subscription history event for audit.
#[derive(Debug, Clone, Default, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PauseSubscriptionInput {
    /// Resume-by timestamp. `None` means an indefinite pause.
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional"
    )]
    pub paused_until: Option<DateTime<Utc>>,
    /// Free-form note attached to the audit history event.
    #[serde(default)]
    pub note: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use bson::oid::ObjectId;

    #[test]
    fn create_input_round_trips_camel_case() {
        let cust = ObjectId::new();
        let item = ObjectId::new();
        let now = Utc::now();
        let json = serde_json::json!({
            "customerId": cust.to_hex(),
            "planId": null,
            "frequency": "monthly",
            "startedAt": now,
            "renewalMode": "auto",
            "items": [
                { "itemId": item.to_hex(), "qty": 1.0, "rate": 999.0, "currency": "INR" }
            ],
            "prorationEnabled": true,
            "trialUntil": now,
        });
        let input: CreateSubscriptionInput = serde_json::from_value(json).unwrap();
        assert_eq!(input.customer_id, cust.to_hex());
        assert!(matches!(input.frequency, BillingFrequency::Monthly));
        assert!(matches!(input.renewal_mode, RenewalMode::Auto));
        assert_eq!(input.items.len(), 1);
        assert_eq!(input.items[0].rate, 999.0);
        assert_eq!(input.proration_enabled, Some(true));
        assert!(input.trial_until.is_some());
    }

    #[test]
    fn update_input_is_empty_detects_all_unset() {
        let empty = UpdateSubscriptionInput::default();
        assert!(empty.is_empty());

        let with_field = UpdateSubscriptionInput {
            renewal_mode: Some(RenewalMode::Manual),
            ..Default::default()
        };
        assert!(!with_field.is_empty());
    }

    #[test]
    fn list_query_defaults_are_none() {
        let q: ListQuery = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(q.page.is_none());
        assert!(q.limit.is_none());
        assert!(q.q.is_none());
        assert!(q.customer_id.is_none());
        assert!(q.status.is_none());
    }

    #[test]
    fn list_query_parses_status_filter() {
        let q: ListQuery =
            serde_json::from_value(serde_json::json!({ "status": "past_due" })).unwrap();
        assert!(matches!(q.status, Some(SubscriptionStatus::PastDue)));
    }

    #[test]
    fn pause_input_accepts_empty_body() {
        let p: PauseSubscriptionInput = serde_json::from_value(serde_json::json!({})).unwrap();
        assert!(p.paused_until.is_none());
        assert!(p.note.is_none());
    }
}
