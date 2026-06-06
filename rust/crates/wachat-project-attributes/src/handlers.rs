//! HTTP handlers for the wachat project-attributes domain.
//!
//! Backs `src/app/wachat/settings/attributes/page.tsx` (the
//! `UserAttributesSettingsTab`). Each handler maps to a function in
//! `src/app/actions/project.actions.ts`:
//!
//! | Endpoint                                      | TS source                  |
//! |-----------------------------------------------|----------------------------|
//! | `GET   /v1/wachat/project-attributes/projects/{id}/attributes` | (read leg of `getProjectById().userAttributes`) |
//! | `PATCH /v1/wachat/project-attributes/projects/{id}/attributes` | `handleSaveUserAttributes` |
//!
//! ## Tenancy guard
//!
//! Both legs are **owner-or-agent** scoped, mirroring the TS
//! `getProjectById(projectId)` access check (`{ _id, $or: [{ userId },
//! { 'agents.userId' }] }`). A missing/forbidden project collapses to a
//! single `404` so project existence is not leaked.
//!
//! ## Storage
//!
//! User attributes are an **embedded array** on the real `projects`
//! collection (`projects.userAttributes[]`) — there is no separate
//! collection. `PATCH` replaces the whole array via `$set`, exactly like
//! the legacy `db.collection('projects').updateOne($set userAttributes)`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{ListAttributesResponse, ReplaceAttributesBody, SuccessResponse, UserAttribute};
use crate::state::WachatProjectAttributesState;

/// Real, existing Mongo collection — user attributes live embedded on the
/// project document, NOT in a `wa_*` collection.
const PROJECTS_COLL: &str = "projects";

/// Allowed `dataType` values (matches the legacy UI `<Select>` options).
const ALLOWED_DATA_TYPES: [&str; 4] = ["TEXT", "NUMBER", "BOOLEAN", "DATE"];
/// Allowed `status` values (matches the legacy `UserAttribute` type).
const ALLOWED_STATUSES: [&str; 2] = ["ACTIVE", "INACTIVE"];

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Load a project and enforce **owner-or-agent** access for the caller.
///
/// Mirrors the TS access query collapsed into a single not-found path so
/// project existence is never leaked:
///
/// ```text
/// db.collection('projects').findOne({
///   _id: new ObjectId(projectId),
///   $or: [{ userId }, { 'agents.userId' }],
/// });
/// ```
async fn load_project_with_membership(
    user: &AuthUser,
    mongo: &MongoHandle,
    project_id_hex: &str,
) -> Result<Document> {
    let project_oid = oid_from_str(project_id_hex)?;
    let uid = user_oid(user)?;

    let coll = mongo.collection::<Document>(PROJECTS_COLL);
    coll.find_one(doc! {
        "_id": project_oid,
        "$or": [
            { "userId": uid },
            { "agents.userId": uid },
        ],
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("projects.find_one")))?
    .ok_or_else(|| {
        ApiError::NotFound("Project not found or you do not have permission.".to_owned())
    })
}

/// Validate one attribute (`name`, `dataType`, `webhookKey`, `status`).
///
/// `webhookKey` is optional/free-form — only `name`, `dataType`, and
/// `status` are constrained.
fn validate_attribute(idx: usize, attr: &UserAttribute) -> Result<()> {
    if attr.name.trim().is_empty() {
        return Err(ApiError::Validation(format!(
            "Attribute #{} is missing a name.",
            idx + 1
        )));
    }
    if !ALLOWED_DATA_TYPES.contains(&attr.data_type.as_str()) {
        return Err(ApiError::Validation(format!(
            "Attribute \"{}\" has an invalid dataType (must be one of {}).",
            attr.name.trim(),
            ALLOWED_DATA_TYPES.join(", ")
        )));
    }
    if !ALLOWED_STATUSES.contains(&attr.status.as_str()) {
        return Err(ApiError::Validation(format!(
            "Attribute \"{}\" has an invalid status (must be one of {}).",
            attr.name.trim(),
            ALLOWED_STATUSES.join(", ")
        )));
    }
    Ok(())
}

/// Build the BSON sub-document for a single attribute, back-filling a
/// stable `id` when the client omitted one.
fn attribute_to_bson(attr: &UserAttribute) -> Document {
    let id = attr
        .id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(str::to_owned)
        .unwrap_or_else(|| ObjectId::new().to_hex());

    let webhook_key: Bson = match attr.webhook_key.as_deref().filter(|s| !s.is_empty()) {
        Some(k) => Bson::String(k.to_owned()),
        None => Bson::Null,
    };

    doc! {
        "id": id,
        "name": attr.name.trim(),
        "dataType": &attr.data_type,
        "webhookKey": webhook_key,
        "status": &attr.status,
    }
}

// ===========================================================================
// GET /v1/wachat/project-attributes/projects/{id}/attributes
// ===========================================================================

/// Return the project's `userAttributes[]` (empty array when unset).
#[instrument(skip_all, fields(project_id = %id))]
pub async fn list_attributes(
    user: AuthUser,
    State(state): State<WachatProjectAttributesState>,
    Path(id): Path<String>,
) -> Result<Json<ListAttributesResponse>> {
    let project = load_project_with_membership(&user, &state.mongo, &id).await?;

    let attributes: Vec<Value> = match project.get("userAttributes") {
        Some(Bson::Array(arr)) => arr
            .iter()
            .map(|b| match b {
                // The common case: each attribute is a sub-document.
                Bson::Document(d) => document_to_clean_json(d.clone()),
                // Defensive fallback for any non-document legacy entry.
                other => other.clone().into_relaxed_extjson(),
            })
            .collect(),
        _ => Vec::new(),
    };

    Ok(Json(ListAttributesResponse { attributes }))
}

// ===========================================================================
// PATCH /v1/wachat/project-attributes/projects/{id}/attributes
// ===========================================================================

/// Replace the project's `userAttributes[]` with a validated set.
///
/// Mirrors `handleSaveUserAttributes`: owner-or-agent guard, then
/// `$set: { userAttributes }` on the `projects` document.
#[instrument(skip_all, fields(project_id = %id))]
pub async fn replace_attributes(
    user: AuthUser,
    State(state): State<WachatProjectAttributesState>,
    Path(id): Path<String>,
    Json(body): Json<ReplaceAttributesBody>,
) -> Result<Json<SuccessResponse>> {
    // ---- Validate every attribute up front ------------------------------
    for (idx, attr) in body.attributes.iter().enumerate() {
        validate_attribute(idx, attr)?;
    }

    // ---- Tenancy guard (owner-or-agent) ---------------------------------
    let project = load_project_with_membership(&user, &state.mongo, &id).await?;
    let project_oid = project
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("project missing _id")))?;

    // ---- Build the replacement array ------------------------------------
    let attrs: Vec<Bson> = body
        .attributes
        .iter()
        .map(|a| Bson::Document(attribute_to_bson(a)))
        .collect();
    let now = bson::DateTime::from_chrono(Utc::now());

    // ---- Persist (full-array replace) -----------------------------------
    let coll = state.mongo.collection::<Document>(PROJECTS_COLL);
    let res = coll
        .update_one(
            doc! { "_id": project_oid },
            doc! { "$set": {
                "userAttributes": Bson::Array(attrs),
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("projects.update_one(userAttributes)"))
        })?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Project not found.".to_owned()));
    }

    Ok(Json(SuccessResponse::ok()))
}
