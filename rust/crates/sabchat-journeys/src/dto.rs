//! Wire-format DTOs for the SabChat **outbound journeys** endpoints.
//!
//! Mirrors the document shape of `sabchat_journeys` /
//! `sabchat_journey_runs`. Every body uses
//! `#[serde(rename_all = "camelCase")]` so JSON round-trips with the TS
//! clients exactly like the sibling routers do.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Journey lifecycle. Only `active` journeys advance on `/tick`.
pub const VALID_JOURNEY_STATUSES: &[&str] = &["draft", "active", "paused"];

/// Step kinds. `message` enqueues an outbox row; `wait` defers the run;
/// `goal` marks an early-exit checkpoint (completes the run).
pub const VALID_STEP_KINDS: &[&str] = &["message", "wait", "goal"];

// ---------------------------------------------------------------------------
// Step — one node in the journey sequence.
// ---------------------------------------------------------------------------

/// A single journey step. The shape is intentionally flat; only the
/// fields relevant to `kind` are populated.
#[derive(Debug, Clone, Deserialize, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct JourneyStep {
    /// Client-supplied stable id (used for editing); regenerated if blank.
    #[serde(default)]
    pub id: String,
    /// One of [`VALID_STEP_KINDS`].
    pub kind: String,
    /// `message`: delivery channel (`chat` | `email` | `sms` | `push`).
    #[serde(default)]
    pub channel: Option<String>,
    /// `message`: body text.
    #[serde(default)]
    pub text: Option<String>,
    /// `wait`: minutes to defer before the next step.
    #[serde(default)]
    pub wait_minutes: Option<i64>,
}

// ---------------------------------------------------------------------------
// POST /journeys
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateJourneyBody {
    pub name: String,
    #[serde(default)]
    pub steps: Vec<JourneyStep>,
}

// ---------------------------------------------------------------------------
// PATCH /journeys/{id}
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJourneyBody {
    #[serde(default)]
    pub name: Option<String>,
    /// One of [`VALID_JOURNEY_STATUSES`].
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub steps: Option<Vec<JourneyStep>>,
}

// ---------------------------------------------------------------------------
// POST /journeys/{id}/enroll — by explicit ids or a tag segment
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnrollBody {
    #[serde(default)]
    pub contact_ids: Vec<String>,
    /// Optional segment: enroll every contact carrying this tag.
    #[serde(default)]
    pub tag: Option<String>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct EnrollResponse {
    pub enrolled: i64,
}

// ---------------------------------------------------------------------------
// POST /tick — cron-callable run advancer
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Default, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TickBody {
    /// Max runs to advance this tick (back-pressure). Defaults to 500.
    #[serde(default)]
    pub limit: Option<i64>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TickReport {
    pub advanced: i64,
    pub messages_enqueued: i64,
    pub completed: i64,
}

// ---------------------------------------------------------------------------
// Generic responses
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct IdResponse {
    pub id: String,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListJourneysResponse {
    #[schema(value_type = Vec<Object>)]
    pub journeys: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct JourneyDetailResponse {
    #[schema(value_type = Object)]
    pub journey: Value,
    #[schema(value_type = Vec<Object>)]
    pub runs: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct OutboxResponse {
    #[schema(value_type = Vec<Object>)]
    pub items: Vec<Value>,
}

#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SuccessResponse {
    pub message: String,
}
