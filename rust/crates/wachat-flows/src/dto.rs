//! Wire-format DTOs for the wachat-flows endpoints.
//!
//! These match the legacy TS shapes from `src/app/actions/flow.actions.ts`
//! exactly so existing callers (the flow-builder UI, `getFlowsForProject`,
//! `getFlowById`, `saveFlow`, `deleteFlow`) keep working unchanged once the
//! TS shim swaps to `rustClient.wachatFlows`.
//!
//! `FlowNode.data` is a free-form object on the TS side (`any`) so we
//! round-trip it as `serde_json::Value` to avoid coupling this crate to the
//! 20+ node-type variants that the flow-builder ships.

use serde::{Deserialize, Serialize};
use serde_json::Value;

/// Query string for `GET /v1/flows` and `GET /v1/flows/builder-data`.
#[derive(Debug, Clone, Deserialize)]
pub struct ProjectIdQuery {
    #[serde(rename = "projectId")]
    pub project_id: String,
}

/// Single graph node. Field names mirror the TS `FlowNode` (camelCase
/// `type`/`position`).
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowNode {
    pub id: String,
    #[serde(rename = "type")]
    pub node_type: String,
    pub data: Value,
    pub position: Position,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Position {
    pub x: f64,
    pub y: f64,
}

/// Single graph edge. `sourceHandle` / `targetHandle` are optional in the TS.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FlowEdge {
    pub id: String,
    pub source: String,
    pub target: String,
    #[serde(rename = "sourceHandle", skip_serializing_if = "Option::is_none")]
    pub source_handle: Option<String>,
    #[serde(rename = "targetHandle", skip_serializing_if = "Option::is_none")]
    pub target_handle: Option<String>,
}

/// Request body for `POST /v1/flows`.
///
/// When `flow_id` is omitted, the handler creates a new row; otherwise it
/// updates the existing row scoped to (`flow_id`, `project_id`).
#[derive(Debug, Clone, Deserialize)]
pub struct SaveFlowReq {
    #[serde(default, rename = "flowId")]
    pub flow_id: Option<String>,
    #[serde(rename = "projectId")]
    pub project_id: String,
    pub name: String,
    #[serde(default)]
    pub nodes: Vec<FlowNode>,
    #[serde(default)]
    pub edges: Vec<FlowEdge>,
    #[serde(default, rename = "triggerKeywords")]
    pub trigger_keywords: Vec<String>,
    /// Optional status — defaults to `ACTIVE` server-side when missing.
    #[serde(default)]
    pub status: Option<String>,
}

/// `{ message?, error?, flowId? }` — matches the TS `saveFlow` return shape.
#[derive(Debug, Clone, Default, Serialize)]
pub struct SaveFlowResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
    #[serde(rename = "flowId", skip_serializing_if = "Option::is_none")]
    pub flow_id: Option<String>,
}

/// `{ message?, error? }` — matches the TS `deleteFlow` return shape.
#[derive(Debug, Clone, Default, Serialize)]
pub struct AckResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Builder-page composition envelope — combines list summaries + initial
/// full flow so the page can render in a single round-trip. Mirrors
/// `getFlowBuilderPageData(projectId)` in the TS.
#[derive(Debug, Clone, Serialize)]
pub struct BuilderDataResult {
    pub flows: Vec<Value>,
    #[serde(rename = "initialFlow")]
    pub initial_flow: Option<Value>,
}

/// `{ flowId?, error? }` — return shape for `POST /v1/flows/{id}/clone`.
///
/// `flowId` is the hex `_id` of the freshly created copy. On access deny /
/// missing source we surface a soft `{ error }` envelope so the UI can show
/// it inline, matching the legacy `cloneFlow` server action's contract.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CloneFlowResult {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub flow_id: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub error: Option<String>,
}

/// Request body for `DELETE /v1/flows/bulk-delete`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteReq {
    #[serde(default)]
    pub flow_ids: Vec<String>,
}

/// `{ deleted }` — number of flows actually removed by the bulk delete.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteResult {
    pub deleted: u64,
}

/// Request body for `PATCH /v1/flows/bulk-status`.
#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkStatusReq {
    #[serde(default)]
    pub flow_ids: Vec<String>,
    pub status: String,
}

/// `{ modified }` — number of flows whose status was changed.
#[derive(Debug, Clone, Default, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct BulkStatusResult {
    pub modified: u64,
}
