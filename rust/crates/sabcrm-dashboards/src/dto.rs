//! Wire-format DTOs for the SabCRM saved-dashboards HTTP surface.
//!
//! A stored dashboard document is
//! `{ _id, projectId, name, widgets: [{ id, type, title, config }], createdAt,
//! updatedAt }`. List / single responses are typed as `serde_json::Value` —
//! the stored document is returned verbatim (cleaned via
//! `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Query params for endpoints that only need the tenant scope
/// (`GET /`, `GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a saved dashboard. `projectId` scopes the row;
/// `name` is required; `widgets` defaults to an empty list.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateDashboardInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Human-readable dashboard name — required.
    pub name: String,
    /// Ordered list of widget objects (`{ id, type, title, config }`).
    /// Defaults to `[]` when absent.
    #[serde(default)]
    #[schema(value_type = Vec<Object>)]
    pub widgets: Option<Value>,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId` / `_id`) is `$set` verbatim; `updatedAt` is always
/// bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateDashboardInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`
    /// (e.g. `name`, `widgets`).
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Response body for `GET /` — a list of raw dashboard documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub dashboards: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /` and `PATCH /{id}` — a single raw
/// dashboard document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct DashboardResponse {
    #[schema(value_type = Object)]
    pub dashboard: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
