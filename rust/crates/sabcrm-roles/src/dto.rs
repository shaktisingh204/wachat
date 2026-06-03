//! Wire-format DTOs for the SabCRM roles & permissions HTTP surface.
//!
//! A role document persisted in `sabcrm_roles`:
//!
//! ```text
//! { _id, projectId, name, description?, permissions: string[],
//!   memberIds: string[], isDefault?, createdAt, updatedAt }
//! ```
//!
//! List / single responses are typed as `serde_json::Value` — the stored
//! document is returned verbatim (cleaned via `document_to_clean_json`,
//! `_id` relabelled to `id`).

use serde::{Deserialize, Serialize};
use serde_json::Value;
use utoipa::ToSchema;

/// Canonical permission keys for reference. Permissions on a role are
/// free-form strings — this is the small curated set the SabCRM UI offers
/// by default; callers may persist any key.
pub const CANONICAL_PERMISSIONS: &[&str] = &[
    "records:read",
    "records:write",
    "records:delete",
    "settings:manage",
    "members:manage",
];

/// Query params for endpoints that only need the tenant scope
/// (`GET /`, `GET /{id}`, `DELETE /{id}`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ScopeQuery {
    /// Tenant scope — required.
    pub project_id: String,
}

/// `POST /` body — create a role. `projectId` scopes the row; `name` is
/// required; `permissions` / `memberIds` default to empty arrays.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct CreateRoleInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Human-readable role name — required.
    pub name: String,
    /// Optional description.
    #[serde(default)]
    pub description: Option<String>,
    /// Free-form permission keys. Defaults to empty.
    #[serde(default)]
    pub permissions: Option<Vec<String>>,
    /// Assigned member ids. Defaults to empty.
    #[serde(default)]
    pub member_ids: Option<Vec<String>>,
    /// Marks this role as the project default. Defaults to false.
    #[serde(default)]
    pub is_default: Option<bool>,
}

/// `PATCH /{id}` body — partial update. Each key in the flattened body
/// (minus `projectId` / `_id`) is `$set` verbatim; `updatedAt` is always
/// bumped.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpdateRoleInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Remaining keys are treated as a partial document and `$set`.
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub patch: Value,
}

/// `POST /{id}/members` body — assign or unassign a single member id.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SetMemberInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The member id to add or remove — required.
    pub member_id: String,
    /// `true` adds the member (`$addToSet`); `false` removes (`$pull`).
    pub assigned: bool,
}

/// Response body for `GET /` — a list of raw role documents.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    #[schema(value_type = Vec<Object>)]
    pub roles: Vec<Value>,
}

/// Response body for `GET /{id}`, `POST /`, `PATCH /{id}` and
/// `POST /{id}/members` — a single raw role document.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RoleResponse {
    #[schema(value_type = Object)]
    pub role: Value,
}

/// Tiny `{ ok: true }` envelope returned by `DELETE /{id}`.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct OkResponse {
    pub ok: bool,
}
