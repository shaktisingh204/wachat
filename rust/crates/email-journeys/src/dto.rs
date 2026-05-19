//! Wire DTOs (HTTP request / response shapes) the journeys router speaks.
//!
//! Every body / query uses `#[serde(rename_all = "camelCase")]` to match
//! the JSON shape the TS client sends. Mongo documents are returned as
//! `serde_json::Value` so the router stays out of the way when callers
//! evolve the document shape.

use email_types::{
    EmailJourneyEdge, EmailJourneyNode, EmailJourneyStatus, EmailJourneyTriggerKind,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;

// ---------------------------------------------------------------------------
// Pagination + envelopes
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PageQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
}

fn default_page() -> u64 {
    1
}
fn default_limit() -> u64 {
    20
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse<T> {
    pub items: Vec<T>,
    pub total: u64,
    pub page: u64,
    pub limit: u64,
    pub has_more: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageResponse {
    pub message: String,
}

// ---------------------------------------------------------------------------
// GET /  — list filters
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JourneysQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    #[serde(default)]
    pub status: Option<EmailJourneyStatus>,
    #[serde(default)]
    pub trigger_kind: Option<EmailJourneyTriggerKind>,
}

// ---------------------------------------------------------------------------
// POST /  — create draft
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateJourneyBody {
    pub name: String,
    #[serde(default)]
    pub description: Option<String>,
    /// Initial nodes + edges (optional — a draft can be created with no
    /// canvas content and edited later via PATCH).
    #[serde(default)]
    pub nodes: Vec<EmailJourneyNode>,
    #[serde(default)]
    pub edges: Vec<EmailJourneyEdge>,
    /// Trigger config — stored verbatim under `journey.trigger`. Free
    /// JSON so kindspecific configs (tag id, segment id, ...) survive.
    #[serde(default)]
    pub trigger: Option<Value>,
}

// ---------------------------------------------------------------------------
// PATCH /{id}
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateJourneyBody {
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub nodes: Option<Vec<EmailJourneyNode>>,
    #[serde(default)]
    pub edges: Option<Vec<EmailJourneyEdge>>,
    #[serde(default)]
    pub trigger: Option<Value>,
}

// ---------------------------------------------------------------------------
// POST /{id}/enroll
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EnrollBody {
    pub subscriber_id: String,
}

// ---------------------------------------------------------------------------
// GET /{id}/runs  — filter
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunsQuery {
    #[serde(default = "default_page")]
    pub page: u64,
    #[serde(default = "default_limit")]
    pub limit: u64,
    /// Mirror of `EmailJourneyRunStatus` ("active" / "waiting" /
    /// "completed" / "exited" / "errored"). Free string here because
    /// the router echoes it directly into the Mongo filter and the type
    /// is closed on the model side.
    #[serde(default)]
    pub status: Option<String>,
}

// ---------------------------------------------------------------------------
// GET /{id}/report
// ---------------------------------------------------------------------------

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReportResponse {
    pub entered: u64,
    pub active: u64,
    pub waiting: u64,
    pub completed: u64,
    pub exited: u64,
    pub errored: u64,
    /// `nodeId → { true_count, false_count }` for condition splits, plus
    /// a `count` for non-conditional nodes. Keys are journey node ids.
    pub per_node: serde_json::Map<String, Value>,
}
