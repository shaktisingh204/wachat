//! Wire-format DTOs for the SabCRM generic records HTTP surface.
//!
//! These mirror the create / update / group payloads accepted by the
//! `src/lib/sabcrm/*.server.ts` record actions and the persisted
//! `SabcrmRecordDoc` shape in `src/lib/sabcrm/db.ts`:
//!
//! ```jsonc
//! {
//!   "_id": ObjectId,        // serialized as `id` (hex) on the wire
//!   "projectId": String,    // tenant scope
//!   "object": String,       // object slug (from the path)
//!   "data": Document,        // free-form field map
//!   "createdBy"?: String,
//!   "createdAt": String,     // RFC3339
//!   "updatedAt": String      // RFC3339
//! }
//! ```
//!
//! List/get responses are typed as `serde_json::Value` — `data` is
//! schemaless and follows the stored Mongo document verbatim (the same
//! `JSON.parse(JSON.stringify(...))` shape the TS code returns), produced
//! via `document_to_clean_json`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /{object}` query params. Tenancy is by `projectId` (required); the
/// handler also scopes by the `{object}` slug from the path. Page is
/// 1-indexed; the handler clamps `limit` at 100.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required. Records are filtered by `{ projectId, object }`.
    pub project_id: String,
    /// Optional free-text match over a few common `data.*` fields
    /// (case-insensitive regex).
    #[serde(default, alias = "query")]
    pub q: Option<String>,
    /// Field key to sort by — applied as `data.<sortBy>` when present,
    /// otherwise the top-level `updatedAt`.
    #[serde(default)]
    pub sort_by: Option<String>,
    /// Sort direction — `asc` | `desc`. Defaults to `desc`.
    #[serde(default)]
    pub sort_dir: Option<String>,
    /// 1-indexed page number. Defaults to 1 when absent or `<= 0`.
    #[serde(default)]
    pub page: Option<u64>,
    /// Page size. Clamped at 100 by the handler. Defaults to 20.
    #[serde(default)]
    pub limit: Option<u64>,
    /// Optional URL-encoded JSON string of structured field filters of shape
    /// `{ "<fieldKey>": <condition>, ... }`. A condition is either a bare
    /// scalar (string/number/bool → equality on `data.<fieldKey>`) or an
    /// object `{ "op": "...", "value": <v> }` with `op` in `eq` | `ne` |
    /// `contains` | `gt` | `lt` | `gte` | `lte` | `in` | `isEmpty` |
    /// `isNotEmpty`. Bad JSON is rejected with a `400`.
    #[serde(default)]
    pub filters: Option<String>,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{object}/{id}`, `DELETE /{object}/{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /{object}` body. The handler sets `createdAt` / `updatedAt`
/// server-side and assigns a fresh `_id`.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRecordInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Free-form field map keyed by the object's field keys.
    #[schema(value_type = Object)]
    pub data: Value,
    /// Optional creator user id.
    #[serde(default)]
    pub created_by: Option<String>,
}

/// `PATCH /{object}/{id}` body. Each key in `data` is `$set` as
/// `data.<key>`; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRecordInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Partial field map — only the keys present are written.
    #[schema(value_type = Object)]
    pub data: Value,
}

/// `POST /{object}/group` body — groups records by `data.<groupByField>`
/// for the kanban board view.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupRecordsInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Field key to group by (e.g. `stage`, `status`, `type`).
    pub group_by_field: String,
}

/// Response body for `GET /{object}` — a page of raw record documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
    pub total: u64,
}

/// Response body for `GET /{object}/{id}`, `POST /{object}` and
/// `PATCH /{object}/{id}` — a single raw record document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordResponse {
    #[schema(value_type = Object)]
    pub record: Value,
}

/// One kanban column in the `group_records` response.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordGroup {
    /// The distinct `data.<groupByField>` value for this column.
    #[schema(value_type = Object)]
    pub value: Value,
    /// Records in this column (capped per group).
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
}

/// Response body for `POST /{object}/group`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct GroupResponse {
    pub groups: Vec<RecordGroup>,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{object}/{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
