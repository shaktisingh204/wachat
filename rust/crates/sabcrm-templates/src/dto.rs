//! Wire-format DTOs for the SabCRM templates HTTP surface.
//!
//! Mirrors `rust/crates/sabcrm-views/src/dto.rs`. List / single responses
//! are typed as `serde_json::Value` — the stored document is returned
//! verbatim (cleaned via `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the templates for a project, optionally
/// filtered by `kind` (`note` | `email` | `task`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional kind filter (`note` | `email` | `task`).
    #[serde(default)]
    pub kind: Option<String>,
}

/// Query params for endpoints that only need the tenant scope
/// (`GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a template. `projectId` scopes the row; the
/// remaining keys form the template document (`name`, `kind`, `subject?`,
/// `body`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateTemplateInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Display name — required.
    pub name: String,
    /// Template kind (`note` | `email` | `task`) — required.
    pub kind: String,
    /// Optional subject line (typically for `email` templates).
    #[serde(default)]
    pub subject: Option<String>,
    /// Template body — required.
    pub body: String,
}

/// `PATCH /{id}` body — partial update. Each present key (minus `projectId`)
/// is `$set` verbatim; `updatedAt` is always bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateTemplateInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// Response body for `GET /` — a list of raw template documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub templates: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /`, `PATCH /{id}` — a single raw
/// template document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct TemplateResponse {
    #[schema(value_type = Object)]
    pub template: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
