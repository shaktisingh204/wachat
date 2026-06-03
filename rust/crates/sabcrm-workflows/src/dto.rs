//! Wire-format DTOs for the SabCRM automation-workflows HTTP surface.
//!
//! A workflow document is:
//!
//! ```jsonc
//! {
//!   "_id", "projectId", "name", "description"?,
//!   "enabled": bool,
//!   "trigger": { "event": "record.created"|"record.updated"|"record.deleted",
//!                "object": "<slug>" },
//!   "steps": [ { "id", "type": "create_task"|"send_notification"
//!                |"update_field"|"webhook", "config": { ... } } ],
//!   "createdAt", "updatedAt", "lastRunAt"?
//! }
//! ```
//!
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the workflows for one project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a workflow. `projectId` scopes the row; `name` is
/// required. `trigger` is the `{ event, object }` shape; `steps` defaults to
/// an empty list, `enabled` to `false`. Server-set: `_id`, `createdAt`,
/// `updatedAt`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateWorkflowInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Human label — required, non-empty.
    pub name: String,
    /// Optional free-text description.
    #[serde(default)]
    pub description: Option<String>,
    /// Record-lifecycle trigger: `{ event, object }`. Stored verbatim.
    #[schema(value_type = Object)]
    pub trigger: Value,
    /// Ordered step pipeline. Each entry is `{ id, type, config }`. Stored
    /// verbatim; defaults to `[]`.
    #[serde(default)]
    #[schema(value_type = Vec<Object>)]
    pub steps: Option<Value>,
    /// Whether the workflow fires. Defaults to `false`.
    #[serde(default)]
    pub enabled: Option<bool>,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId` / `_id`) is `$set` verbatim; `updatedAt` is always
/// bumped. Covers enable/disable, trigger swaps and step edits.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateWorkflowInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Response body for `GET /` — a list of raw workflow documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub workflows: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /` and `PATCH /{id}` — a single raw
/// workflow document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct WorkflowResponse {
    #[schema(value_type = Object)]
    pub workflow: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
