//! DTOs returned by [`WebhookSubscriber`](crate::WebhookSubscriber).
//!
//! These are pure data types — `Serialize`/`Deserialize` so HTTP handlers
//! one layer up can ship them straight into the SabNode response envelope
//! without re-mapping.

use serde::{Deserialize, Serialize};

/// Subscription status for a single WABA.
///
/// Mirrors the TS return shape `{ isActive: boolean }` from
/// `getWebhookSubscriptionStatus`. Unlike the TS we don't return an
/// inline `error` — failures bubble up as `ApiError` from the
/// transport layer.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionStatus {
    /// `true` iff the WABA's `subscribed_apps` list is non-empty.
    pub is_active: bool,
}

/// Per-project failure record returned from
/// [`WebhookSubscriber::subscribe_all`](crate::WebhookSubscriber::subscribe_all).
///
/// The `error` string is the human-readable Meta message (or skip
/// reason — e.g. `"missing wabaId"`) suitable for the dashboard toast.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeFailure {
    /// Hex-encoded Mongo `_id` of the offending project.
    pub project_id: String,
    /// Human-readable failure reason.
    pub error: String,
}

/// Outcome of a bulk subscribe across all projects.
///
/// `attempted` is the total number of projects considered (including
/// the ones that were skipped for missing fields), so
/// `attempted == succeeded + failed.len()`. `succeeded` only counts
/// Meta `POST /…/subscribed_apps` calls that returned 2xx.
#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct SubscribeAllOutcome {
    pub attempted: usize,
    pub succeeded: usize,
    pub failed: Vec<SubscribeFailure>,
}
