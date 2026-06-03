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

/// Canonical permission-flag keys — SabCRM's structured analogue of Twenty's
/// `PermissionFlagType`. These are the feature/settings/tool capabilities a
/// role can hold. Stored on the role as `permissionFlags: string[]`, validated
/// against this list. Split into two families (settings + tools), exposed here
/// as one flat canonical set (25 keys).
///
/// Mirrors `twenty-shared`'s `PermissionFlagType`; see
/// `docs/twenty-review/06-server-metadata-permissions.md` §2.4.
pub const CANONICAL_PERMISSION_FLAGS: &[&str] = &[
    // --- Settings permissions ---
    "API_KEYS_AND_WEBHOOKS",
    "WORKSPACE",
    "WORKSPACE_MEMBERS",
    "ROLES",
    "DATA_MODEL",
    "SECURITY",
    "WORKFLOWS",
    "IMPERSONATE",
    "SSO_BYPASS",
    "APPLICATIONS",
    "MARKETPLACE_APPS",
    "LAYOUTS",
    "BILLING",
    "AI_SETTINGS",
    // --- Tool permissions ---
    "AI",
    "VIEWS",
    "UPLOAD_FILE",
    "DOWNLOAD_FILE",
    "SEND_EMAIL_TOOL",
    "HTTP_REQUEST_TOOL",
    "CODE_INTERPRETER_TOOL",
    "IMPORT_CSV",
    "EXPORT_CSV",
    "CONNECTED_ACCOUNTS",
    "PROFILE_INFORMATION",
];

/// Returns `true` if `flag` is a recognised canonical permission-flag key.
pub fn is_canonical_permission_flag(flag: &str) -> bool {
    CANONICAL_PERMISSION_FLAGS.contains(&flag)
}

/// Role-level "all records" CRUD defaults — Twenty's
/// `canReadAll/canUpdateAll/canSoftDeleteAll/canDestroyAll` matrix.
///
/// Each flag is the workspace-wide default-allow for that verb across **all**
/// objects; per-object [`ObjectPermissionTw`] overrides refine it. All fields
/// are optional so a role that omits `defaults` keeps today's behavior.
#[derive(Debug, Clone, Default, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct RoleDefaultsTw {
    /// Default-allow READ across all objects.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_read_all: Option<bool>,
    /// Default-allow UPDATE across all objects.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_update_all: Option<bool>,
    /// Default-allow SOFT-DELETE (trash) across all objects.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_soft_delete_all: Option<bool>,
    /// Default-allow DESTROY (permanent delete) across all objects.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub can_destroy_all: Option<bool>,
}

/// Per-object tri-state CRUD override (Twenty's `ObjectPermissionEntity`).
///
/// Each verb is **nullable tri-state**: `Some(true)` grant, `Some(false)` deny,
/// `None` inherit the role default ([`RoleDefaultsTw`]).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct ObjectPermissionTw {
    /// Target object metadata name/id this override applies to.
    pub object: String,
    /// READ override (tri-state).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read: Option<bool>,
    /// UPDATE override (tri-state).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub update: Option<bool>,
    /// SOFT-DELETE (trash) override (tri-state).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub soft_delete: Option<bool>,
    /// DESTROY (permanent delete) override (tri-state).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub destroy: Option<bool>,
}

/// Per-field tri-state override (Twenty's `FieldPermissionEntity`).
///
/// Layered on top of object permissions: `read` controls field-value
/// visibility, `update` controls field-value write. Both tri-state via
/// `Option<bool>` (`None` = inherit).
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct FieldPermissionTw {
    /// Owning object metadata name/id.
    pub object: String,
    /// Field metadata name/id this override applies to.
    pub field: String,
    /// READ-value override (tri-state).
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub read: Option<bool>,
    /// UPDATE-value override (tri-state). In Twenty this only revokes write
    /// (`false`/`null`); SabCRM keeps the same shape but does not enforce it.
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub update: Option<bool>,
}

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
    /// Structured capability flags (canonical [`CANONICAL_PERMISSION_FLAGS`]).
    /// Additive sibling of `permissions`; unknown keys are rejected.
    #[serde(default)]
    pub permission_flags: Option<Vec<String>>,
    /// Role-level "all records" CRUD defaults. Omitted ⇒ today's behavior.
    #[serde(default)]
    pub defaults: Option<RoleDefaultsTw>,
    /// Per-object tri-state CRUD overrides.
    #[serde(default)]
    pub object_permissions: Option<Vec<ObjectPermissionTw>>,
    /// Per-field tri-state read/update overrides.
    #[serde(default)]
    pub field_permissions: Option<Vec<FieldPermissionTw>>,
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
