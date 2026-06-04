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

// ===========================================================================
// apply-segment (Twenty parity, additive)
// ===========================================================================

/// `POST /{id}/apply` body — apply a stored segment's records-filter AST to the
/// `sabcrm_records` collection server-side and return a page of records.
///
/// The segment's persisted `filters` (the records-filter AST — see
/// [`crate::filter`]) is translated to a Mongo predicate scoped by
/// `{ projectId, object: segment.object }`. An optional inline `filter` AST
/// (same shape) is ANDed on top so callers can refine a saved segment without
/// mutating it (Twenty's "view + adhoc filter" behaviour). Sort prefers the
/// segment's `sortBy` / `sortDir`, else top-level `updatedAt` desc.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApplySegmentInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// 1-indexed page number. Defaults to 1 when absent or `<= 0`.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Clamped at 100 by the handler. Defaults to 50.
    #[serde(default)]
    pub limit: Option<u64>,
    /// Optional adhoc records-filter AST ANDed on top of the segment's stored
    /// filter (a leaf `{ field, op, value? }`, a group
    /// `{ op: "and" | "or", conditions: [...] }`, or an array of nodes). Absent
    /// / `null` → the segment's stored filter is used verbatim.
    #[serde(default)]
    #[schema(value_type = Object)]
    pub filter: Option<Value>,
    /// Optional sort-field override (`data.<sortBy>`, or the `createdAt` /
    /// `updatedAt` audit column). Falls back to the segment's stored `sortBy`.
    #[serde(default)]
    pub sort_by: Option<String>,
    /// Optional sort direction override — `asc` | `desc`. Falls back to the
    /// segment's stored `sortDir`, then `desc`.
    #[serde(default)]
    pub sort_dir: Option<String>,
}

/// Response body for `POST /{id}/apply` — a page of records matching the
/// segment's records-filter AST. Mirrors the records list wire shape
/// (`{ records, total }`, `_id` → `id`).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApplySegmentResponse {
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
    pub total: u64,
}
