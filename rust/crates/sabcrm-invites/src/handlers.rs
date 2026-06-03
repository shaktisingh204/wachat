//! HTTP handlers for the SabCRM invites domain.
//!
//! Create / list / revoke / delete over the `sabcrm_invites` Mongo
//! collection.
//!
//! | Endpoint                                  | TS action       |
//! |-------------------------------------------|-----------------|
//! | `GET    /v1/sabcrm/invites`               | `listInvites`   |
//! | `POST   /v1/sabcrm/invites`               | `createInvite`  |
//! | `POST   /v1/sabcrm/invites/{id}/revoke`   | `revokeInvite`  |
//! | `DELETE /v1/sabcrm/invites/{id}`          | `deleteInvite`  |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `{ projectId }`. `invitedBy` is the
//! caller from the [`AuthUser`](sabnode_auth::AuthUser) extractor — never a
//! request body. The extractor is required on every endpoint so the surface
//! is never anonymously open.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{
    CreateInviteInput, InviteResponse, ListQuery, ListResponse, OkResponse, RevokeResponse,
    ScopeQuery,
};

/// The Mongo collection backing workspace-member invitations.
const INVITES_COLL: &str = "sabcrm_invites";

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

// ===========================================================================
// GET / — listInvites
// ===========================================================================

/// `GET /v1/sabcrm/invites` — list a project's invites, newest first
/// (`createdAt` desc), optionally filtered by `status`.
#[instrument(skip_all)]
pub async fn list_invites(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(query): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let project_id = require_project(&query.project_id)?;

    let mut filter = doc! { "projectId": project_id };
    if let Some(status) = query.status.as_deref() {
        let status = status.trim();
        if !status.is_empty() {
            filter.insert("status", status);
        }
    }

    let coll = mongo.collection::<Document>(INVITES_COLL);
    let mut cursor = coll
        .find(filter)
        .sort(doc! { "createdAt": -1 })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_invites.find")))?;

    let mut invites = Vec::new();
    while let Some(d) = cursor
        .try_next()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabcrm_invites.cursor")))?
    {
        invites.push(record_to_wire(d));
    }

    Ok(Json(ListResponse { invites }))
}

// ===========================================================================
// POST / — createInvite
// ===========================================================================

/// `POST /v1/sabcrm/invites` — create a pending invite for the caller's
/// project. Rejects (`409`) a duplicate *pending* invite for the same
/// `(projectId, email)`. `token` is a fresh `ObjectId` hex; `invitedBy` is
/// the caller; `status` is `pending`.
#[instrument(skip_all)]
pub async fn create_invite(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(body): Json<CreateInviteInput>,
) -> Result<Json<InviteResponse>> {
    let project_id = require_project(&body.project_id)?;
    let email = body.email.trim().to_lowercase();
    if email.is_empty() {
        return Err(ApiError::Validation("email is required.".to_owned()));
    }

    let coll = mongo.collection::<Document>(INVITES_COLL);

    // Reject a duplicate pending invite for the same (projectId, email).
    let existing = coll
        .find_one(doc! { "projectId": project_id, "email": &email, "status": "pending" })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_invites.find_one(dup)"))
        })?;
    if existing.is_some() {
        return Err(ApiError::Conflict(
            "A pending invite already exists for this email.".to_owned(),
        ));
    }

    let mut new_doc = doc! {
        "_id": ObjectId::new(),
        "projectId": project_id,
        "email": &email,
        "status": "pending",
        "token": ObjectId::new().to_hex(),
        "invitedBy": &user.user_id,
        "createdAt": Utc::now().to_rfc3339(),
    };
    if let Some(role_id) = body.role_id.as_deref() {
        let role_id = role_id.trim();
        if !role_id.is_empty() {
            new_doc.insert("roleId", role_id);
        }
    }

    coll.insert_one(&new_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabcrm_invites.insert_one"))
    })?;

    Ok(Json(InviteResponse {
        invite: record_to_wire(new_doc),
    }))
}

// ===========================================================================
// POST /{id}/revoke — revokeInvite
// ===========================================================================

/// `POST /v1/sabcrm/invites/{id}/revoke` — set `status = revoked`. Returns
/// `404` if no invite matches `{ projectId, _id }`. Returns `{ ok, invite }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn revoke_invite(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<RevokeResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(INVITES_COLL);
    let updated = coll
        .find_one_and_update(
            doc! { "projectId": project_id, "_id": oid },
            doc! { "$set": { "status": "revoked" } },
        )
        .return_document(mongodb::options::ReturnDocument::After)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabcrm_invites.find_one_and_update(revoke)"),
            )
        })?
        .ok_or_else(|| ApiError::NotFound("invite".to_owned()))?;

    Ok(Json(RevokeResponse {
        ok: true,
        invite: record_to_wire(updated),
    }))
}

// ===========================================================================
// DELETE /{id} — deleteInvite
// ===========================================================================

/// `DELETE /v1/sabcrm/invites/{id}` — scoped delete. Returns `404` if no
/// invite matches `{ projectId, _id }`.
#[instrument(skip_all, fields(id = %id))]
pub async fn delete_invite(
    _user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Query(query): Query<ScopeQuery>,
) -> Result<Json<OkResponse>> {
    let project_id = require_project(&query.project_id)?;
    let oid = oid_from_str(&id)?;

    let coll = mongo.collection::<Document>(INVITES_COLL);
    let result = coll
        .delete_one(doc! { "projectId": project_id, "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabcrm_invites.delete_one"))
        })?;

    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("invite".to_owned()));
    }

    Ok(Json(OkResponse { ok: true }))
}
