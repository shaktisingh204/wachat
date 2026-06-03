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

/// `GET /{object}/count` query params. Carries the SAME tenant scope +
/// free-text `q` + structured `filters` as [`ListQuery`] (pagination / sort
/// are irrelevant to a count) so the count respects the active filter set.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CountQuery {
    /// Tenant scope — required. Records are filtered by `{ projectId, object }`.
    pub project_id: String,
    /// Optional free-text match over a few common `data.*` fields
    /// (case-insensitive regex). Mirrors [`ListQuery::q`].
    #[serde(default, alias = "query")]
    pub q: Option<String>,
    /// Optional URL-encoded JSON string of structured field filters, of the
    /// same shape accepted by [`ListQuery::filters`]. Bad JSON → `400`.
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

/// Response body for `GET /{object}/count` — the number of records matching
/// the active `{ projectId, object }` + `q` + `filters` predicate.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CountResponse {
    pub count: u64,
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

/// One relation block in the `record_relations` response — the related
/// records reachable from a single RELATION field of the source object.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RecordRelation {
    /// Field key on the source object that defines this relation.
    pub field: String,
    /// Human label of that field.
    pub label: String,
    /// Slug of the related object.
    pub target_object: String,
    /// Cardinality from the source record's perspective
    /// (`MANY_TO_ONE` | `ONE_TO_MANY`).
    pub kind: String,
    /// The related records (capped per relation).
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
}

/// Response body for `GET /{object}/{id}/related`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RelationsResponse {
    pub relations: Vec<RecordRelation>,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{object}/{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}

/// `POST /{object}/bulk-delete` body. Deletes every record matching
/// `{ projectId, object, _id ∈ ids }`. Ids that aren't valid ObjectIds are
/// skipped (no error) rather than failing the whole batch.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Hex ObjectId strings of the records to delete. Invalid ids are skipped.
    pub ids: Vec<String>,
}

/// Response body for `POST /{object}/bulk-delete`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkDeleteResponse {
    pub ok: bool,
    /// Number of records actually deleted.
    pub deleted: u64,
}

/// `POST /{object}/bulk-update` body. `$set`s each `data.<k>` on every record
/// matching `{ projectId, object, _id ∈ ids }` and bumps `updatedAt`. Invalid
/// ids are skipped rather than failing the whole batch.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkUpdateInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Hex ObjectId strings of the records to update. Invalid ids are skipped.
    pub ids: Vec<String>,
    /// Field map — each key is written as `data.<key>` on every matched record.
    #[schema(value_type = Object)]
    pub data: Value,
}

/// Response body for `POST /{object}/bulk-update`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct BulkUpdateResponse {
    pub ok: bool,
    /// Number of records actually modified.
    pub updated: u64,
}
