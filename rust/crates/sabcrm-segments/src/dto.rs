//! Wire-format DTOs for the SabCRM saved-segments HTTP surface.
//!
//! A segment is a named object + filter definition. List / single responses
//! are typed as `serde_json::Value` — the stored document is returned
//! verbatim (cleaned via `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the segments, optionally narrowed to one object.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug whose segments to list — optional.
    #[serde(default)]
    pub object: Option<String>,
}

/// `POST /` body — create a saved segment. `projectId` scopes the row; the
/// remaining keys form the segment document (`name`, `object`, `filters`,
/// `sortBy`, `sortDir`, `color`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateSegmentInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are persisted as the segment document.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub segment: Value,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId`) is `$set` verbatim; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateSegmentInput {
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

/// Response body for `GET /` — a list of raw segment documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub segments: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /` and `PATCH /{id}` — a single raw
/// segment document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SegmentResponse {
    #[schema(value_type = Object)]
    pub segment: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
