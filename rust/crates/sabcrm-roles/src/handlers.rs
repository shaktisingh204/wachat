//! HTTP handlers for the SabCRM roles & permissions domain.
//!
//! CRUD over the `sabcrm_roles` Mongo collection.
//!
//! | Endpoint                                  | TS source            |
//! |-------------------------------------------|----------------------|
//! | `GET    /v1/sabcrm/roles`                 | `listRoles`          |
//! | `GET    /v1/sabcrm/roles/{id}`            | `getRole`            |
//! | `POST   /v1/sabcrm/roles`                 | `createRole`         |
//! | `PATCH  /v1/sabcrm/roles/{id}`            | `updateRole`         |
//! | `DELETE /v1/sabcrm/roles/{id}`            | `deleteRole`         |
//! | `POST   /v1/sabcrm/roles/{id}/members`    | `setRoleMember`      |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId: <string> }` (plus
//! `_id` as appropriate) — **not** `userId`. Every handler requires the
//! [`AuthUser`](sabnode_auth::AuthUser) extractor so the surface is never
//! anonymously open.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde::Serialize;
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    AssignMemberRoleInput, AssignMemberRoleResponse, CreateRoleInput, FieldPermissionTw,
    ListResponse, MembersResponse, ObjectPermissionTw, OkResponse, RoleResponse, ScopeQuery,
    SeedRolesInput, SeedRolesResponse, SetMemberInput, UpdateRoleInput,
    UpsertFieldPermissionsInput, UpsertObjectPermissionsInput, UpsertPermissionFlagsInput,
    is_canonical_permission_flag, CANONICAL_PERMISSION_FLAGS, STANDARD_ROLE_ADMIN,
    STANDARD_ROLE_GUEST, STANDARD_ROLE_MEMBER,
};

/// The Mongo collection backing roles.
const ROLES_COLL: &str = "sabcrm_roles";

// ===========================================================================
// helpers
// ===========================================================================

/// Reject an empty `projectId` early — every filter leads with it.
fn require_project(project_id: &str) -> Result<&str> {
    let p = project_id.trim();
    if p.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    Ok(p)
}

/// Reject any unknown permission-flag key so only the canonical set persists.
fn validate_permission_flags(flags: &[String]) -> Result<()> {
    if let Some(bad) = flags.iter().find(|f| !is_canonical_permission_flag(f)) {
        return Err(ApiError::Validation(format!(
            "unknown permission flag: {bad}"
        )));
    }
    Ok(())
}

/// Twenty's read/write consistency rule: a role cannot be granted UPDATE,
/// SOFT-DELETE or DESTROY on an object while READ is explicitly denied
/// (`Some(false)`). `None` read inherits the role default, so it's allowed.
fn validate_object_permissions_consistency(perms: &[ObjectPermissionTw]) -> Result<()> {
    for p in perms {
        let read_denied = p.read == Some(false);
        let wants_write =
            p.update == Some(true) || p.soft_delete == Some(true) || p.destroy == Some(true);
        if read_denied && wants_write {
            return Err(ApiError::Validation(format!(
                "object '{}' cannot grant write/delete without read.",
                p.object
            )));
        }
    }
    Ok(())
}

/// Serialize a value into `Bson`, mapping any error to a `400`.
fn to_bson_field(value: &impl Serialize, ctx: &'static str) -> Result<Bson> {
    bson::to_bson(value)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context(ctx)))
}

/// Clean a stored document into the wire JSON, renaming `_id` → `id` (hex).
fn record_to_wire(doc: Document) -> Value {
    let mut json = document_to_clean_json(doc);
    if let Value::Object(map) = &mut json {
        if let Some(id) = map.remove("_id") {
            map.insert("id".to_owned(), id);
        }
    }
    json
}

/// Convert an incoming flattened JSON object into a BSON `Document`,
/// dropping `_id` / `projectId` so callers cannot rewrite tenancy keys.
fn payload_to_set(value: &Value) -> Result<Document> {
    let bson = bson::to_bson(value).map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.payload.to_bson"))
    })?;
    let doc = match bson {
        Bson::Document(d) => d,
        _ => return Err(ApiError::Validation("body must be an object.".to_owned())),
    };
    let mut out = Document::new();
    for (k, v) in doc {
        if matches!(k.as_str(), "_id" | "projectId") {
            continue;
        }
        out.insert(k, v);
    }
    Ok(out)
}

/// `$set` a single field on a project-scoped role, bumping `updatedAt`, and
/// return the post-update document. `404` if no role matches.
async fn set_role_field(
    mongo: &MongoHandle,
    project_id: &str,
    oid: ObjectId,
    field: &str,
    value: Bson,
) -> Result<Document> {
    let coll = mongo.collection::<Document>(ROLES_COLL);
    let mut set = Document::new();
    set.insert(field, value);
    set.insert("updatedAt", Utc::now().to_rfc3339());
    coll.find_one_and_update(
        doc! { "projectId": project_id, "_id": oid },
        doc! { "$set": set },
    )
    .return_document(mongodb::options::ReturnDocument::After)
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.set_role_field"))
    })?
    .ok_or_else(|| ApiError::NotFound("role".to_owned()))
}

/// Blueprint for a seeded standard role.
struct StandardRoleSpec {
    standard_id: &'static str,
    name: &'static str,
    icon: &'static str,
    description: &'static str,
    can_update_all_settings: bool,
    can_access_all_tools: bool,
    /// Role-level "all records" CRUD defaults: `(read, update, soft_delete, destroy)`.
    defaults: (bool, bool, bool, bool),
    /// Whether to grant every canonical permission flag (Admin only).
    all_flags: bool,
}

impl StandardRoleSpec {
    fn to_document(&self, project_id: &str, now: &str) -> Document {
        let (read, update, soft_delete, destroy) = self.defaults;
        let flags: Vec<Bson> = if self.all_flags {
            CANONICAL_PERMISSION_FLAGS.iter().map(Bson::from).collect()
        } else {
            Vec::new()
        };
        doc! {
            "_id": ObjectId::new(),
            "projectId": project_id,
            "standardId": self.standard_id,
            "name": self.name,
            "label": self.name,
            "icon": self.icon,
            "description": self.description,
            "permissions": Vec::<Bson>::new(),
            "permissionFlags": flags,
            "defaults": {
                "canReadAll": read,
                "canUpdateAll": update,
                "canSoftDeleteAll": soft_delete,
                "canDestroyAll": destroy,
            },
            "objectPermissions": Vec::<Bson>::new(),
            "fieldPermissions": Vec::<Bson>::new(),
            "canUpdateAllSettings": self.can_update_all_settings,
            "canAccessAllTools": self.can_access_all_tools,
            "canBeAssignedToUsers": true,
            "canBeAssignedToApiKeys": self.standard_id != STANDARD_ROLE_GUEST,
            "canBeAssignedToAgents": self.standard_id != STANDARD_ROLE_GUEST,
            "isEditable": false,
            "isDefault": self.standard_id == STANDARD_ROLE_MEMBER,
            "memberIds": Vec::<Bson>::new(),
            "createdAt": now,
            "updatedAt": now,
        }
    }
}

/// The three Twenty-standard roles, in display order (Admin, Member, Guest).
///
/// - **Admin** — every settings + tool flag, full CRUD across all objects.
/// - **Member** — full CRUD across all objects, no settings access (Twenty's
///   `createMemberRole`).
/// - **Guest** — read-only object access, no tools or settings (Twenty's
///   `createGuestRole`).
fn standard_role_specs() -> [StandardRoleSpec; 3] {
    [
        StandardRoleSpec {
            standard_id: STANDARD_ROLE_ADMIN,
            name: "Admin",
            icon: "IconUserCog",
            description: "Full access to all records, tools and settings.",
            can_update_all_settings: true,
            can_access_all_tools: true,
            defaults: (true, true, true, true),
            all_flags: true,
        },
        StandardRoleSpec {
            standard_id: STANDARD_ROLE_MEMBER,
            name: "Member",
            icon: "IconUser",
            description: "Full access to all records, limited settings access.",
            can_update_all_settings: false,
            can_access_all_tools: true,
            defaults: (true, true, true, false),
            all_flags: false,
        },
        StandardRoleSpec {
            standard_id: STANDARD_ROLE_GUEST,
            name: "Guest",
            icon: "IconUserOff",
            description: "Read-only access to records, no tools or settings.",
            can_update_all_settings: false,
            can_access_all_tools: false,
            defaults: (true, false, false, false),
            all_flags: false,
        },
    ]
}

// ===========================================================================
// GET / — listRoles
// ===========================================================================

/// `GET /v1/sabcrm/roles` — list every role for the project, scoped by
/// `{ projectId }`.
#[instrument(skip_all)]
pub async fn list_roles(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let coll = mongo.collection::<Document>(ROLES_COLL);
    let mut cursor = coll
        .find(doc! { "projectId": project_id })
        .sort(doc! { "createdAt": 1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.find")))?;

    let mut roles = Vec::new();
    while let Some(d) = cursor.try_next().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.cursor"))
    })? {
        roles.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { roles }))
}

// ===========================================================================
// GET /{id} — getRole
// ===========================================================================

/// `GET /v1/sabcrm/roles/{id}` — fetch one role, scoped by
/// `{ projectId, _id }`. `404` if missing.
#[instrument(skip_all, fields(id = %id))]
pub async fn get_role(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<RoleResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(ROLES_COLL);
    let role = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;

    Ok(Json(RoleResponse {
        role: record_to_wire(role),
    }))
}

// ===========================================================================
// POST / — createRole
// ===========================================================================

/// `POST /v1/sabcrm/roles` — create a role. `permissions` / `memberIds`
/// default to empty arrays; `createdAt` / `updatedAt` are set server-side
/// (RFC3339).
#[instrument(skip_all)]
pub async fn create_role(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateRoleInput>,
) -> Result<Json<RoleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let name = body.name.trim();
    if name.is_empty() {
        return Err(ApiError::Validation("name is required.".to_owned()));
    }

    let permissions = body.permissions.unwrap_or_default();
    let permission_flags = body.permission_flags.unwrap_or_default();
    validate_permission_flags(&permission_flags)?;
    let member_ids = body.member_ids.unwrap_or_default();
    let now = Utc::now().to_rfc3339();

    let mut new_doc = Document::new();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("name", name);
    new_doc.insert("label", body.label.as_deref().unwrap_or(name));
    if let Some(icon) = body.icon.as_deref() {
        new_doc.insert("icon", icon);
    }
    if let Some(desc) = body.description.as_deref() {
        new_doc.insert("description", desc);
    }
    new_doc.insert(
        "canUpdateAllSettings",
        body.can_update_all_settings.unwrap_or(false),
    );
    new_doc.insert("canAccessAllTools", body.can_access_all_tools.unwrap_or(false));
    new_doc.insert(
        "canBeAssignedToUsers",
        body.can_be_assigned_to_users.unwrap_or(true),
    );
    new_doc.insert(
        "canBeAssignedToApiKeys",
        body.can_be_assigned_to_api_keys.unwrap_or(true),
    );
    new_doc.insert(
        "canBeAssignedToAgents",
        body.can_be_assigned_to_agents.unwrap_or(true),
    );
    new_doc.insert("isEditable", body.is_editable.unwrap_or(true));
    new_doc.insert(
        "permissions",
        permissions.iter().map(Bson::from).collect::<Vec<_>>(),
    );
    new_doc.insert(
        "permissionFlags",
        permission_flags.iter().map(Bson::from).collect::<Vec<_>>(),
    );
    if let Some(defaults) = body.defaults.as_ref() {
        new_doc.insert("defaults", to_bson_field(defaults, "sabcrm_roles.defaults")?);
    }
    if let Some(object_permissions) = body.object_permissions.as_ref() {
        new_doc.insert(
            "objectPermissions",
            to_bson_field(object_permissions, "sabcrm_roles.objectPermissions")?,
        );
    }
    if let Some(field_permissions) = body.field_permissions.as_ref() {
        new_doc.insert(
            "fieldPermissions",
            to_bson_field(field_permissions, "sabcrm_roles.fieldPermissions")?,
        );
    }
    new_doc.insert(
        "memberIds",
        member_ids.iter().map(Bson::from).collect::<Vec<_>>(),
    );
    new_doc.insert("isDefault", body.is_default.unwrap_or(false));
    new_doc.insert("createdAt", &now);
    new_doc.insert("updatedAt", &now);

    let coll = mongo.collection::<Document>(ROLES_COLL);
    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.insert_one"))
    })?;

    Ok(Json(RoleResponse {
        role: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// PATCH /{id} — updateRole
// ===========================================================================

/// `PATCH /v1/sabcrm/roles/{id}` — partial update. Each key in the
/// flattened body (minus `projectId` / `_id`) is `$set` verbatim;
/// `updatedAt` is always bumped. Returns the updated role.
#[instrument(skip_all, fields(id = %id))]
pub async fn update_role(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpdateRoleInput>,
) -> Result<Json<RoleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let mut set = payload_to_set(&body.patch)?;

    // If the patch touches `permissionFlags`, validate against the canonical set
    // before persisting (the generic patch round-trips every other key verbatim).
    if let Some(Bson::Array(flags)) = set.get("permissionFlags") {
        let keys: Vec<String> = flags
            .iter()
            .filter_map(|b| b.as_str().map(str::to_owned))
            .collect();
        validate_permission_flags(&keys)?;
    }

    set.insert("updatedAt", Utc::now().to_rfc3339());

    let coll = mongo.collection::<Document>(ROLES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": set },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.find_one_and_update"))
        })?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;

    Ok(Json(RoleResponse {
        role: record_to_wire(updated),
    }))
}

// ===========================================================================
// PUT /{id}/object-permissions — upsertObjectPermissions
// ===========================================================================

/// `PUT /v1/sabcrm/roles/{id}/object-permissions` — replace the role's
/// per-object CRUD matrix wholesale. Enforces read/write consistency before
/// persisting. Returns the updated role; `404` if no role matches.
#[instrument(skip_all, fields(id = %id))]
pub async fn upsert_object_permissions(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpsertObjectPermissionsInput>,
) -> Result<Json<RoleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;
    validate_object_permissions_consistency(&body.object_permissions)?;

    let value = to_bson_field(&body.object_permissions, "sabcrm_roles.objectPermissions")?;
    let updated = set_role_field(&mongo, project_id, oid, "objectPermissions", value).await?;
    Ok(Json(RoleResponse {
        role: record_to_wire(updated),
    }))
}

// ===========================================================================
// PUT /{id}/field-permissions — upsertFieldPermissions
// ===========================================================================

/// `PUT /v1/sabcrm/roles/{id}/field-permissions` — replace the role's per-field
/// read/update matrix wholesale. Returns the updated role; `404` if missing.
#[instrument(skip_all, fields(id = %id))]
pub async fn upsert_field_permissions(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpsertFieldPermissionsInput>,
) -> Result<Json<RoleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    // Drop fields that explicitly deny read while granting update — same
    // consistency principle as objects (read controls visibility).
    if let Some(bad) = body
        .field_permissions
        .iter()
        .find(|f: &&FieldPermissionTw| f.read == Some(false) && f.update == Some(true))
    {
        return Err(ApiError::Validation(format!(
            "field '{}.{}' cannot grant update without read.",
            bad.object, bad.field
        )));
    }

    let value = to_bson_field(&body.field_permissions, "sabcrm_roles.fieldPermissions")?;
    let updated = set_role_field(&mongo, project_id, oid, "fieldPermissions", value).await?;
    Ok(Json(RoleResponse {
        role: record_to_wire(updated),
    }))
}

// ===========================================================================
// PUT /{id}/permission-flags — upsertPermissionFlags
// ===========================================================================

/// `PUT /v1/sabcrm/roles/{id}/permission-flags` — replace the role's
/// capability flags wholesale. Each key must be canonical. `404` if missing.
#[instrument(skip_all, fields(id = %id))]
pub async fn upsert_permission_flags(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<UpsertPermissionFlagsInput>,
) -> Result<Json<RoleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;
    validate_permission_flags(&body.permission_flags)?;

    // De-dup while preserving the canonical order for a stable stored shape.
    let mut flags: Vec<&String> = Vec::new();
    for f in &body.permission_flags {
        if !flags.iter().any(|e| *e == f) {
            flags.push(f);
        }
    }
    let value = Bson::Array(flags.into_iter().map(Bson::from).collect());
    let updated = set_role_field(&mongo, project_id, oid, "permissionFlags", value).await?;
    Ok(Json(RoleResponse {
        role: record_to_wire(updated),
    }))
}

// ===========================================================================
// GET /{id}/members — getWorkspaceMembersAssignedToRole
// ===========================================================================

/// `GET /v1/sabcrm/roles/{id}/members` — list the member ids assigned to a
/// role. `404` if no role matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn list_role_members(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<MembersResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(ROLES_COLL);
    let role = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;

    let member_ids = role
        .get_array("memberIds")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_str().map(str::to_owned))
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    Ok(Json(MembersResponse { member_ids }))
}

// ===========================================================================
// POST /assign-member — updateWorkspaceMemberRole
// ===========================================================================

/// `POST /v1/sabcrm/roles/assign-member` — move a member to exactly one role,
/// removing them from any other role in the project first. Guards:
///
/// - the destination role must have `canBeAssignedToUsers != false`;
/// - the caller cannot demote themselves (`updatorMemberId == memberId`);
/// - the last admin cannot be moved off the admin role.
#[instrument(skip_all)]
pub async fn assign_member_role(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<AssignMemberRoleInput>,
) -> Result<Json<AssignMemberRoleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let member_id = body.member_id.trim();
    if member_id.is_empty() {
        return Err(ApiError::Validation("memberId is required.".to_owned()));
    }
    if body.role_id.trim().is_empty() {
        return Err(ApiError::Validation("roleId is required.".to_owned()));
    }
    let target_oid = oid_from_str(&body.role_id)?;

    if let Some(updator) = body.updator_member_id.as_deref() {
        if updator.trim() == member_id {
            return Err(ApiError::Forbidden(
                "a member cannot change their own role.".to_owned(),
            ));
        }
    }

    let coll = mongo.collection::<Document>(ROLES_COLL);

    // Resolve the destination role and enforce assignability.
    let target = coll
        .find_one(doc! { "projectId": project_id, "_id": target_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;
    if target.get_bool("canBeAssignedToUsers") == Ok(false) {
        return Err(ApiError::Validation(
            "role cannot be assigned to users.".to_owned(),
        ));
    }

    // Find the member's current role(s) in this project, if any.
    let mut previous_role: Option<Value> = None;
    let current = coll
        .find_one(doc! { "projectId": project_id, "memberIds": member_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.find_one(current)"))
        })?;

    if let Some(ref cur) = current {
        // No-op if already on the destination role.
        if cur.get_object_id("_id").ok() == Some(target_oid) {
            return Ok(Json(AssignMemberRoleResponse {
                role: record_to_wire(target),
                previous_role: None,
            }));
        }

        // Last-admin guard: if leaving an admin role, ensure another member holds it.
        if cur.get_str("standardId") == Ok(STANDARD_ROLE_ADMIN)
            && target.get_str("standardId") != Ok(STANDARD_ROLE_ADMIN)
        {
            let admin_count = cur
                .get_array("memberIds")
                .map(|a| a.len())
                .unwrap_or_default();
            if admin_count <= 1 {
                return Err(ApiError::Validation(
                    "cannot remove the last admin from the Admin role.".to_owned(),
                ));
            }
        }
    }

    let now = Utc::now().to_rfc3339();

    // Remove the member from every other role in the project (a member holds
    // one role at a time), then add to the destination role.
    coll.update_many(
        doc! { "projectId": project_id, "_id": { "$ne": target_oid } },
        doc! { "$pull": { "memberIds": member_id }, "$set": { "updatedAt": &now } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.update_many(unassign)"))
    })?;

    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": target_oid },
            doc! { "$addToSet": { "memberIds": member_id }, "$set": { "updatedAt": &now } },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.assign(member)"))
        })?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;

    if let Some(cur) = current {
        if cur.get_object_id("_id").ok() != Some(target_oid) {
            previous_role = Some(record_to_wire(cur));
        }
    }

    Ok(Json(AssignMemberRoleResponse {
        role: record_to_wire(updated),
        previous_role,
    }))
}

// ===========================================================================
// POST /seed — createMemberRole / createGuestRole + admin bootstrap
// ===========================================================================

/// `POST /v1/sabcrm/roles/seed` — idempotently provision the three standard
/// roles (`Admin`, `Member`, `Guest`) for a project. Each role is keyed by its
/// `standardId`; existing rows are returned untouched, missing ones created.
/// Optionally assigns the seeded **Admin** role to `adminMemberId`.
#[instrument(skip_all)]
pub async fn seed_standard_roles(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<SeedRolesInput>,
) -> Result<Json<SeedRolesResponse>> {
    let project_id = require_project(&body.project_id)?;
    let coll = mongo.collection::<Document>(ROLES_COLL);
    let now = Utc::now().to_rfc3339();

    let mut roles = Vec::with_capacity(3);
    let mut created_any = false;

    for spec in standard_role_specs() {
        let existing = coll
            .find_one(doc! { "projectId": project_id, "standardId": spec.standard_id })
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.find_one(seed)"))
            })?;

        let doc = match existing {
            Some(d) => d,
            None => {
                created_any = true;
                let d = spec.to_document(project_id, &now);
                coll.insert_one(&d).await.map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("sabcrm_roles.insert_one(seed)"),
                    )
                })?;
                d
            }
        };
        roles.push(doc);
    }

    // Optionally assign the freshly-seeded Admin role to the bootstrapper.
    if let Some(admin_member) = body.admin_member_id.as_deref() {
        let admin_member = admin_member.trim();
        if !admin_member.is_empty() {
            coll.update_one(
                doc! { "projectId": project_id, "standardId": STANDARD_ROLE_ADMIN },
                doc! {
                    "$addToSet": { "memberIds": admin_member },
                    "$set": { "updatedAt": &now },
                },
            )
            .await
            .map_err(|e| {
                ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.seed(assign-admin)"))
            })?;
            // Re-read the admin role so the response reflects the assignment.
            if let Some(d) = coll
                .find_one(doc! { "projectId": project_id, "standardId": STANDARD_ROLE_ADMIN })
                .await
                .map_err(|e| {
                    ApiError::Internal(
                        anyhow::Error::new(e).context("sabcrm_roles.seed(reread-admin)"),
                    )
                })?
            {
                if let Some(first) = roles.first_mut() {
                    *first = d;
                }
            }
        }
    }

    let roles = roles.into_iter().map(record_to_wire).collect();
    Ok(Json(SeedRolesResponse { roles, created_any }))
}

// ===========================================================================
// DELETE /{id} — deleteRole
// ===========================================================================

/// `DELETE /v1/sabcrm/roles/{id}` — scoped delete. Returns `404` if no
/// role matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_role(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(ROLES_COLL);

    // Twenty prevents deleting the default/standard roles. Look the role up
    // first so non-editable seeded roles (and the project default) are
    // protected with a 422 rather than silently removed.
    let role = coll
        .find_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.find_one")))?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;
    if role.get_bool("isEditable") == Ok(false) || role.get_bool("isDefault") == Ok(true) {
        return Err(ApiError::Validation(
            "this role is a standard or default role and cannot be deleted.".to_owned(),
        ));
    }

    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_roles.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("role".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}

// ===========================================================================
// POST /{id}/members — setRoleMember
// ===========================================================================

/// `POST /v1/sabcrm/roles/{id}/members` — assign (`$addToSet`) or unassign
/// (`$pull`) a single member id on a role. Bumps `updatedAt`. Returns the
/// updated role; `404` if no role matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn set_role_member(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(body): Json<SetMemberInput>,
) -> Result<Json<RoleResponse>> {
    let project_id = require_project(&body.project_id)?;
    let oid = oid_from_str(&id)?;

    let member_id = body.member_id.trim();
    if member_id.is_empty() {
        return Err(ApiError::Validation("memberId is required.".to_owned()));
    }

    let now = Utc::now().to_rfc3339();
    let update = if body.assigned {
        doc! {
            "$addToSet": { "memberIds": member_id },
            "$set": { "updatedAt": &now },
        }
    } else {
        doc! {
            "$pull": { "memberIds": member_id },
            "$set": { "updatedAt": &now },
        }
    };

    let coll = mongo.collection::<Document>(ROLES_COLL);
    let updated = coll
        .find_one_and_update(doc! { "projectId": project_id, "_id": oid }, update)
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_roles.find_one_and_update(member)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("role".to_owned()))?;

    Ok(Json(RoleResponse {
        role: record_to_wire(updated),
    }))
}
