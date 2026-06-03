//! Wire-format DTOs for the SabCRM tags HTTP surface.
//!
//! The persisted document is `{ _id, projectId, name, color, createdAt }`.
//! List responses return the stored document verbatim (cleaned via
//! `document_to_clean_json`, `_id` relabelled to `id`).

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

/// `DELETE /{id}` query params — scope the delete to a project.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// Response body for `GET /` — the project's tags, newest first.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub tags: Vec<Value>,
}

/// Response body for `POST /` and `PATCH /{id}` — the affected tag.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TagResponse {
    #[schema(value_type = Object)]
    pub tag: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
