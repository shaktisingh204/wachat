//! Wire-format DTOs for the SabCRM tags HTTP surface.
//!
//! Two persisted documents back this surface:
//!
//! - the tag definition `{ _id, projectId, name, color, createdAt }`; and
//! - a tag→record assignment
//!   `{ _id, projectId, tagId, object, recordId, createdAt }` in the
//!   `sabcrm_tag_assignments` collection (the join table that powers
//!   apply / remove on records and usage counts).
//!
//! List responses return the stored document verbatim (cleaned via
//! `document_to_clean_json`, `_id` relabelled to `id`). Tag list / get
//! responses additionally carry a derived `usageCount`.

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the tags for a project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a tag.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTagInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Display name of the tag — required, unique per project.
    pub name: String,
    /// Optional color (hex / token); defaults to empty if omitted.
    #[serde(default)]
    pub color: Option<String>,
}

/// `PATCH /{id}` body — partial update of a tag. `projectId` scopes the
/// update; `name` / `color` are optional partials.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTagInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// New display name — when present, must stay unique per project.
    #[serde(default)]
    pub name: Option<String>,
    /// New color.
    #[serde(default)]
    pub color: Option<String>,
}

/// `DELETE /{id}` / `GET /{id}` query params — scope to a project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /{id}/apply` body — apply a tag to a single record.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ApplyTagInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug of the target record (e.g. `person`, `company`).
    pub object: String,
    /// Serialized id of the target record.
    pub record_id: String,
}

/// `DELETE /{id}/apply` query params — remove a tag from a single record.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RemoveTagQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug of the target record.
    pub object: String,
    /// Serialized id of the target record.
    pub record_id: String,
}

/// `GET /{id}/records` query params — list the records a tag is applied to,
/// optionally filtered to one `object` slug.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TaggedRecordsQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional object-slug filter.
    #[serde(default)]
    pub object: Option<String>,
}

/// `GET /for-record` query params — list the tags applied to one record.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TagsForRecordQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Object slug of the record.
    pub object: String,
    /// Serialized id of the record.
    pub record_id: String,
}

/// Response body for `GET /` — the project's tags, newest first. Each tag
/// carries a derived `usageCount` (number of records it is applied to).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub tags: Vec<Value>,
}

/// Response body for `POST /`, `PATCH /{id}` and `GET /{id}` — the affected
/// tag. Carries a derived `usageCount`.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TagResponse {
    #[schema(value_type = Object)]
    pub tag: Value,
}

/// Response body for `POST /{id}/apply` — the upserted assignment.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AssignmentResponse {
    #[schema(value_type = Object)]
    pub assignment: Value,
}

/// Response body for `GET /{id}/records` — the records a tag is applied to.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TaggedRecordsResponse {
    #[schema(value_type = Vec<Object>)]
    pub records: Vec<Value>,
}

/// Response body for `GET /for-record` — the tags applied to one record.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TagsForRecordResponse {
    #[schema(value_type = Vec<Object>)]
    pub tags: Vec<Value>,
}

/// A single `{ tagId, usageCount }` row in the counts response.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TagCount {
    /// Hex id of the tag.
    pub tag_id: String,
    /// Number of records the tag is applied to.
    pub usage_count: u64,
}

/// Response body for `GET /counts` — per-tag usage counts for a project.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CountsResponse {
    pub counts: Vec<TagCount>,
}

/// Tiny `{ ok: true }` envelope returned by delete / remove endpoints.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
