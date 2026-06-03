//! Wire-format DTOs for the SabCRM sales-pipelines HTTP surface.
//!
//! Mirrors the persisted `sabcrm_pipelines` document shape:
//!
//! ```text
//! { _id, projectId, name, object (default "opportunities"),
//!   stages: [{ id, label, color }], isDefault?, createdAt, updatedAt }
//! ```
//!
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the pipelines for one project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a pipeline. `projectId` scopes the row; the
/// remaining keys form the pipeline document (`name`, `object`, `stages`,
/// `isDefault`). `object` defaults to `"opportunities"` server-side; an
/// empty `stages` defaults to `[]`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreatePipelineInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are persisted as the pipeline document.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub pipeline: Value,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId`) is `$set` verbatim; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdatePipelineInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// Response body for `GET /` — a list of raw pipeline documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub pipelines: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /`, `PATCH /{id}` — a single raw
/// pipeline document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PipelineResponse {
    #[schema(value_type = Object)]
    pub pipeline: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
