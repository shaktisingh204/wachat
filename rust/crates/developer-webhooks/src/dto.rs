//! Wire-format DTOs for the webhook control plane.

use serde::{Deserialize, Serialize};

/* ── Subscriptions ─────────────────────────────────────────────────────── */

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubBody {
    pub url: String,
    /// Event names to subscribe to. Empty = receive nothing (paused).
    #[serde(default)]
    pub events: Vec<String>,
    /// Optional human-readable label.
    #[serde(default)]
    pub description: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSubBody {
    #[serde(default)]
    pub url: Option<String>,
    #[serde(default)]
    pub events: Option<Vec<String>>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Subscription {
    #[serde(rename = "_id")]
    pub id: String,
    pub tenant_id: String,
    pub url: String,
    pub events: Vec<String>,
    pub status: String,
    pub description: Option<String>,
    pub created_at: String,
    pub last_delivery_at: Option<String>,
    /// Number of consecutive failed deliveries — used by the worker for
    /// auto-pause once a threshold is hit.
    pub consecutive_failures: u64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateSubResult {
    pub subscription: Subscription,
    /// Plain-text signing secret — returned exactly once.
    pub secret: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SubscriptionList {
    pub data: Vec<Subscription>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/* ── Deliveries ────────────────────────────────────────────────────────── */

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Delivery {
    #[serde(rename = "_id")]
    pub id: String,
    pub subscription_id: String,
    pub event: String,
    pub status: String,
    pub attempts: u64,
    pub response_status: Option<i32>,
    pub last_error: Option<String>,
    pub created_at: String,
    pub finished_at: Option<String>,
    pub next_attempt_at: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryList {
    pub data: Vec<Delivery>,
    pub next_cursor: Option<String>,
}
