//! Wire-format DTOs for the SabCRM workflow-runs HTTP surface.
//!
//! A workflow run captures one execution of a workflow:
//! `{ _id, projectId, workflowId, status, trigger, startedAt, finishedAt?,
//!    steps: [{ id, type, status, output?, error? }], createdAt }`.
//!
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list runs (newest first), optionally filtered to
/// one workflow, with an optional limit.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Restrict to a single workflow's runs — optional.
    #[serde(default)]
    pub workflow_id: Option<String>,
    /// Max number of runs to return. Clamped server-side; defaults to 50.
    #[serde(default)]
    pub limit: Option<u64>,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a workflow run. `workflowId` is required; the
/// remaining keys (`trigger`, `status`, `steps`, …) are persisted on the
/// run document. `startedAt` / `createdAt` are set server-side and
/// `status` defaults to `running` when absent.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRunInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys (`workflowId`, `trigger`, `status?`, `steps?`, …)
    /// are persisted as the run document.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub run: Value,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId` / `_id`) is `$set` verbatim; commonly used to flip
/// `status`, append/replace `steps`, or stamp `finishedAt`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRunInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Response body for `GET /` — a list of raw run documents (newest first).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub runs: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /` and `PATCH /{id}` — a single
/// raw run document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunResponse {
    #[schema(value_type = Object)]
    pub run: Value,
}
