//! Wire-format DTOs for the SabCRM saved-views HTTP surface.
//!
//! Mirrors the payloads accepted by `src/lib/sabcrm/views.server.ts` and
//! the persisted `SabcrmViewDoc` shape in `src/lib/sabcrm/db.ts`. List /
//! single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the views for one object.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug whose views to list — required.
    pub object: String,
}

/// `POST /` body — create a saved view. `projectId` scopes the row; the
/// remaining keys form the view document (`object`, `name`, `kind`,
/// `filters`, `sortBy`, `sortDir`, `fields`, `groupByField`, `isDefault`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateViewInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are persisted as the view document.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub view: Value,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId`) is `$set` verbatim; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateViewInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Query params for endpoints that only need the tenant scope
/// (`DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /{id}/default` body — tenant scope only.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetDefaultInput {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /{id}/run` body — apply a saved view's filters/sort to the
/// `sabcrm_records` collection server-side and return a page of records.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunViewInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// 1-indexed page number. Defaults to 1 when absent or `<= 0`.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Clamped at 100 by the handler. Defaults to 50.
    #[serde(default)]
    pub limit: Option<u64>,
}

/// Response body for `GET /` — a list of raw view documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub views: Vec<Value>,
}

/// Response body for `POST /`, `PATCH /{id}` and `POST /{id}/default` — a
/// single raw view document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ViewResponse {
    #[schema(value_type = Object)]
    pub view: Value,
}

/// Response body for `POST /{id}/run` — a page of records matching the
/// view's filters/sort. Mirrors the records list wire shape
/// (`{ records, total }`, `_id` → `id`).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RunViewResponse {
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
    pub total: u64,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
