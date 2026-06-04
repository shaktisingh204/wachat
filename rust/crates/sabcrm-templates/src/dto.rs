//! Wire-format DTOs for the SabCRM templates HTTP surface.
//!
//! Mirrors `rust/crates/sabcrm-views/src/dto.rs`. List / single responses
//! are typed as `serde_json::Value` — the stored document is returned
//! verbatim (cleaned via `document_to_clean_json`, `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// `GET /` query params — list the templates for a project, optionally
/// filtered by `kind` (`note` | `email` | `task`) and/or `objectType` (the
/// CRM object slug the template is associated with, e.g. `companies`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListQuery {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional kind filter (`note` | `email` | `task`).
    #[serde(default)]
    pub kind: Option<String>,
    /// Optional per-object association filter (CRM object slug). Twenty
    /// scopes message/note templates to a single object type.
    #[serde(default)]
    pub object_type: Option<String>,
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
    /// Optional per-object association (CRM object slug, e.g. `companies`).
    /// Mirrors Twenty's object-scoped templates.
    #[serde(default)]
    pub object_type: Option<String>,
    /// Optional subject line (typically for `email` templates). May embed
    /// `{{variable}}` placeholders resolved at render time.
    #[serde(default)]
    pub subject: Option<String>,
    /// Template body — required. May embed `{{variable}}` placeholders.
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

/// `POST /{id}/render` body — render a stored template against a record.
///
/// Exactly one variable source is used, in priority order:
/// 1. `recordId` + `object` — fetch `{ projectId, object, _id }` from
///    `sabcrm_records` and substitute its `data` field map; or
/// 2. `variables` — an inline JSON object of `{ path: value }` pairs used
///    directly (a preview without persisting a record).
///
/// When `recordId` is supplied, any `variables` object is merged on top of
/// the record fields, letting a caller override individual values.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RenderInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// CRM object slug for the record lookup (required when `recordId` set).
    #[serde(default)]
    pub object: Option<String>,
    /// Id of a record in `sabcrm_records` to source variables from.
    #[serde(default)]
    pub record_id: Option<String>,
    /// Inline variable map (used alone, or layered over a fetched record).
    #[serde(default)]
    #[schema(value_type = Object)]
    pub variables: Option<Value>,
}

/// `POST /preview` body — render an ad-hoc `subject` / `body` (not yet
/// persisted) against a variable source. Same variable-source semantics as
/// [`RenderInput`] plus the template strings inline.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct PreviewInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional subject template string.
    #[serde(default)]
    pub subject: Option<String>,
    /// Body template string — required.
    pub body: String,
    /// CRM object slug for the record lookup (required when `recordId` set).
    #[serde(default)]
    pub object: Option<String>,
    /// Id of a record in `sabcrm_records` to source variables from.
    #[serde(default)]
    pub record_id: Option<String>,
    /// Inline variable map (used alone, or layered over a fetched record).
    #[serde(default)]
    #[schema(value_type = Object)]
    pub variables: Option<Value>,
}

/// Response body for the render / preview endpoints — the interpolated
/// strings plus the distinct placeholder paths that did not resolve.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RenderResponse {
    /// Rendered subject (omitted when the template had no subject).
    #[serde(skip_serializing_if = "Option::is_none")]
    pub subject: Option<String>,
    /// Rendered body.
    pub body: String,
    /// Distinct `{{placeholder}}` paths that resolved to no value, across
    /// both subject and body. Useful for highlighting gaps in a preview.
    pub missing_variables: Vec<String>,
}
