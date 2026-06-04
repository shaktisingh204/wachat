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

/// A standard role's `standardId` — the stable identity Twenty uses to keep the
/// three seeded roles (`Admin`, `Member`, `Guest`) recognisable across
/// reseeds. Persisted as the role's `standardId` string field.
pub const STANDARD_ROLE_ADMIN: &str = "admin";
/// `standardId` for the seeded **Member** role.
pub const STANDARD_ROLE_MEMBER: &str = "member";
/// `standardId` for the seeded **Guest** role.
pub const STANDARD_ROLE_GUEST: &str = "guest";

/// The recognised target kinds a role can be assigned to — Twenty's
/// `RoleTarget` discriminant (`user` / `apiKey` / `agent`). SabCRM stores
/// assignments inline on the role (`memberIds`, `apiKeyIds`, `agentIds`); this
/// enum names the families for the assignment endpoints.
pub const ROLE_TARGET_KINDS: &[&str] = &["user", "apiKey", "agent"];

/// Returns `true` if `kind` is a recognised role-target discriminant.
pub fn is_valid_role_target(kind: &str) -> bool {
    ROLE_TARGET_KINDS.contains(&kind)
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
    /// Optional display label (Twenty's `label`). Falls back to `name` when
    /// omitted so existing callers keep working.
    #[serde(default)]
    pub label: Option<String>,
    /// Optional icon key (Twenty's `icon`, e.g. `IconUserCog`).
    #[serde(default)]
    pub icon: Option<String>,
    /// Optional description.
    #[serde(default)]
    pub description: Option<String>,
    /// Workspace-wide settings master switch — Twenty's `canUpdateAllSettings`.
    /// When `true` the role implicitly holds every settings permission flag.
    #[serde(default)]
    pub can_update_all_settings: Option<bool>,
    /// Tool master switch — Twenty's `canAccessAllTools`. When `true` the role
    /// implicitly holds every tool permission flag.
    #[serde(default)]
    pub can_access_all_tools: Option<bool>,
    /// Whether this role may be assigned to workspace members. Defaults `true`.
    #[serde(default)]
    pub can_be_assigned_to_users: Option<bool>,
    /// Whether this role may be assigned to API keys. Defaults `true`.
    #[serde(default)]
    pub can_be_assigned_to_api_keys: Option<bool>,
    /// Whether this role may be assigned to AI agents. Defaults `true`.
    #[serde(default)]
    pub can_be_assigned_to_agents: Option<bool>,
    /// Whether the role can be edited/deleted from the UI. Seeded standard
    /// roles set this `false`. Defaults `true`.
    #[serde(default)]
    pub is_editable: Option<bool>,
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

// ===========================================================================
// Standard-role seeding
// ===========================================================================

/// `POST /seed` body — idempotently provision the three standard roles
/// (`Admin`, `Member`, `Guest`) for a project. Mirrors Twenty's
/// `createMemberRole` / `createGuestRole` + the admin bootstrap.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SeedRolesInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// Optional member id to assign the freshly-seeded **Admin** role to (the
    /// workspace bootstrapper). Skipped when omitted.
    #[serde(default)]
    pub admin_member_id: Option<String>,
}

/// Response body for `POST /seed` — the three standard role documents
/// (existing rows are reused, missing ones are created).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct SeedRolesResponse {
    #[schema(value_type = Vec<Object>)]
    pub roles: Vec<Value>,
    /// `true` if at least one role was newly created this call.
    pub created_any: bool,
}

// ===========================================================================
// Granular permission upserts (Twenty's upsert* mutations)
// ===========================================================================

/// `PUT /{id}/object-permissions` body — replace the role's per-object CRUD
/// matrix wholesale (Twenty's `upsertObjectPermissions`). Write/delete grants
/// require a read grant; this is validated server-side.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpsertObjectPermissionsInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The full desired set of per-object overrides.
    pub object_permissions: Vec<ObjectPermissionTw>,
}

/// `PUT /{id}/field-permissions` body — replace the role's per-field
/// read/update matrix wholesale (Twenty's `upsertFieldPermissions`).
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpsertFieldPermissionsInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The full desired set of per-field overrides.
    pub field_permissions: Vec<FieldPermissionTw>,
}

/// `PUT /{id}/permission-flags` body — replace the role's capability flags
/// wholesale (Twenty's `upsertPermissionFlags`). Each key must be canonical.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct UpsertPermissionFlagsInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The full desired set of capability flags.
    pub permission_flags: Vec<String>,
}

// ===========================================================================
// Member ↔ role assignment (Twenty's updateWorkspaceMemberRole)
// ===========================================================================

/// `POST /assign-member` body — assign a single member to exactly one role,
/// unassigning them from any other role first (a member holds one role at a
/// time, like Twenty's `updateWorkspaceMemberRole`). Guards prevent removing
/// the last admin and a caller demoting themselves.
#[derive(Debug, Clone, Deserialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AssignMemberRoleInput {
    /// Tenant scope — required.
    pub project_id: String,
    /// The workspace member being (re)assigned — required.
    pub member_id: String,
    /// The destination role's id — required.
    pub role_id: String,
    /// The acting member's id, if known. Used to block self-demotion.
    #[serde(default)]
    pub updator_member_id: Option<String>,
}

/// Response body for `POST /assign-member` — the member's new role plus the
/// role they were moved off (if any).
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct AssignMemberRoleResponse {
    #[schema(value_type = Object)]
    pub role: Value,
    /// The previous role document the member was removed from, when applicable.
    #[schema(value_type = Option<Object>)]
    #[serde(skip_serializing_if = "Option::is_none")]
    pub previous_role: Option<Value>,
}

/// Response body for `GET /{id}/members` — the member ids assigned to a role.
#[derive(Debug, Clone, Serialize, ToSchema)]
#[serde(rename_all = "camelCase")]
pub struct MembersResponse {
    pub member_ids: Vec<String>,
}
