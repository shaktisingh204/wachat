//! Wire DTOs for the Telegram Flows visual-flow API.
//!
//! Telegram-scoped flows are modelled as a SabFlow-style graph (nodes + edges)
//! with Telegram-specific trigger and node types. The shape is intentionally
//! permissive — node `data` and edge metadata are passed through as
//! `serde_json::Value` so the front-end editor (which owns the per-node form
//! shape) can evolve without round-tripping a Rust schema change.

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};

// ── Trigger ──────────────────────────────────────────────────────────────────

/// Telegram-specific trigger that fires the flow.
///
/// `kind` is the discriminant; the remaining fields are optional and only
/// populated for the matching variant. We use an internally-tagged union
/// (rather than untagged) so an empty / missing field cannot accidentally
/// collapse two variants.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FlowTrigger {
    /// "incoming_message" | "command" | "callback_query" | "schedule" | "business_connection"
    pub kind: String,
    /// For `incoming_message`: optional message filter.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub filter: Option<TriggerFilter>,
    /// For `command`: the slash-command name (no leading "/").
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub command: Option<String>,
    /// For `callback_query`: optional prefix to match on `data`.
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "dataPrefix"
    )]
    pub data_prefix: Option<String>,
    /// For `schedule`: standard cron expression.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cron: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct TriggerFilter {
    /// "regex" | "exact" | "contains" | "hasMedia"
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub value: Option<String>,
}

// ── Graph ────────────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FlowNode {
    pub id: String,
    /// One of the telegram-specific node types — `send_message`, `send_media`,
    /// `send_keyboard`, `wait_for_reply`, `branch_by_text`, `branch_by_callback`,
    /// `assign_agent`, `tag_contact`, `set_variable`, `http_request`,
    /// `run_subflow`, `end`. Free-form so adding a new node type doesn't require
    /// touching this crate.
    #[serde(rename = "type")]
    pub kind: String,
    #[serde(default)]
    pub position: NodePosition,
    /// Opaque node settings — owned by the front-end editor.
    #[serde(default)]
    pub data: serde_json::Value,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct NodePosition {
    #[serde(default)]
    pub x: f64,
    #[serde(default)]
    pub y: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "sourceHandle"
    )]
    pub source_handle: Option<String>,
    #[serde(
        default,
        skip_serializing_if = "Option::is_none",
        rename = "targetHandle"
    )]
    pub target_handle: Option<String>,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub label: Option<String>,
}

// ── Flow document ────────────────────────────────────────────────────────────

#[derive(Debug, Clone, Serialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct FlowRow {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    pub description: String,
    /// "draft" | "published" | "disabled"
    pub status: String,
    pub version: i64,
    #[serde(rename = "latestPublishedVersion")]
    pub latest_published_version: i64,
    pub trigger: FlowTrigger,
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "createdAt"
    )]
    pub created_at: DateTime<Utc>,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "updatedAt"
    )]
    pub updated_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "lastRunAt",
        skip_serializing_if = "Option::is_none"
    )]
    pub last_run_at: Option<DateTime<Utc>>,
    #[serde(rename = "runCount")]
    pub run_count: i64,
    #[serde(rename = "errorCount")]
    pub error_count: i64,
}

// ── Request bodies ───────────────────────────────────────────────────────────

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub status: Option<String>,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub page: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResp {
    pub flows: Vec<FlowRow>,
    pub total: i64,
    pub page: u32,
    pub limit: u32,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub trigger: Option<FlowTrigger>,
    #[serde(default)]
    pub nodes: Option<Vec<FlowNode>>,
    #[serde(default)]
    pub edges: Option<Vec<FlowEdge>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default)]
    pub name: Option<String>,
    #[serde(default)]
    pub description: Option<String>,
    #[serde(default)]
    pub trigger: Option<FlowTrigger>,
    #[serde(default)]
    pub nodes: Option<Vec<FlowNode>>,
    #[serde(default)]
    pub edges: Option<Vec<FlowEdge>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProjectScopedQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SimulatedMessage {
    #[serde(default)]
    pub text: Option<String>,
    #[serde(default, rename = "callbackData")]
    pub callback_data: Option<String>,
    #[serde(default)]
    pub command: Option<String>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestBody {
    #[serde(rename = "projectId")]
    pub project_id: String,
    #[serde(default, rename = "botId")]
    pub bot_id: Option<String>,
    #[serde(rename = "simulatedMessage")]
    pub simulated_message: SimulatedMessage,
}

// ── Response shapes ──────────────────────────────────────────────────────────

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AckResult {
    pub success: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none", rename = "flowId")]
    pub flow_id: Option<String>,
    #[serde(skip_serializing_if = "Vec::is_empty", rename = "validationErrors")]
    pub validation_errors: Vec<ValidationError>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ValidationError {
    pub field: String,
    pub code: String,
    pub message: String,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct FlowResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flow: Option<FlowRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionRow {
    pub version: i64,
    pub status: String,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "publishedAt",
        skip_serializing_if = "Option::is_none"
    )]
    pub published_at: Option<DateTime<Utc>>,
    pub trigger: FlowTrigger,
    pub nodes: Vec<FlowNode>,
    pub edges: Vec<FlowEdge>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionsResp {
    pub versions: Vec<VersionRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VersionResp {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub version: Option<VersionRow>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TestStep {
    #[serde(rename = "nodeId")]
    pub node_id: String,
    #[serde(rename = "nodeType")]
    pub node_type: String,
    pub status: String,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub output: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct TestResp {
    pub success: bool,
    pub steps: Vec<TestStep>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunRow {
    #[serde(rename = "_id")]
    pub id: String,
    #[serde(rename = "flowId")]
    pub flow_id: String,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub status: String,
    #[serde(
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime",
        rename = "startedAt"
    )]
    pub started_at: DateTime<Utc>,
    #[serde(
        default,
        with = "bson::serde_helpers::chrono_datetime_as_bson_datetime_optional",
        rename = "finishedAt",
        skip_serializing_if = "Option::is_none"
    )]
    pub finished_at: Option<DateTime<Utc>>,
    #[serde(rename = "durationMs", skip_serializing_if = "Option::is_none")]
    pub duration_ms: Option<i64>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(default)]
    pub steps: Vec<TestStep>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RunsQuery {
    #[serde(default, rename = "projectId")]
    pub project_id: Option<String>,
    #[serde(default)]
    pub cursor: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RunsResp {
    pub runs: Vec<RunRow>,
    #[serde(rename = "nextCursor", skip_serializing_if = "Option::is_none")]
    pub next_cursor: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}
