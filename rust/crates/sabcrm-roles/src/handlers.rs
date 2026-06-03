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
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateRoleInput, ListResponse, OkResponse, RoleResponse, ScopeQuery, SetMemberInput,
    UpdateRoleInput,
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
    let member_ids = body.member_ids.unwrap_or_default();
    let now = Utc::now().to_rfc3339();

    let mut new_doc = Document::new();
    new_doc.insert("_id", ObjectId::new());
    new_doc.insert("projectId", project_id);
    new_doc.insert("name", name);
    if let Some(desc) = body.description.as_deref() {
        new_doc.insert("description", desc);
    }
    new_doc.insert(
        "permissions",
        permissions.iter().map(Bson::from).collect::<Vec<_>>(),
    );
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
