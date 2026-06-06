//! HTTP handlers for the wachat interactive-builder domain.
//!
//! All endpoints are scoped to the authenticated user (`userId`) and the
//! `projectId` they pass in. The `/wachat/templates/interactive-message-builder`
//! page is the sole consumer today.
//!
//! | Endpoint                                       | Action            |
//! |------------------------------------------------|-------------------|
//! | `GET    /v1/wachat/interactive-builder/templates`      | list templates  |
//! | `POST   /v1/wachat/interactive-builder/templates`      | save template   |
//! | `DELETE /v1/wachat/interactive-builder/templates/{id}` | delete template |

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{ListTemplatesQuery, ListTemplatesResponse, SaveTemplateBody, SuccessResponse};
use crate::state::WachatInteractiveBuilderState;

const COLL: &str = "wa_interactive_templates";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Best-effort `serde_json::Value` → `bson::Bson` for free-form payload storage.
fn serde_value_to_bson(v: &Value) -> Bson {
    Bson::try_from(v.clone()).unwrap_or(Bson::Null)
}

// ===========================================================================
// GET /v1/wachat/interactive-builder/templates?projectId=
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_templates(
    user: AuthUser,
    State(state): State<WachatInteractiveBuilderState>,
    Query(query): Query<ListTemplatesQuery>,
) -> Result<Json<ListTemplatesResponse>> {
    let uid = user_oid(&user)?;
    let project_id = query.project_id.trim();
    if project_id.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }

    let cursor = state
        .mongo
        .collection::<Document>(COLL)
        .find(doc! { "userId": uid, "projectId": project_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("interactive_templates.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("interactive_templates.collect"))
    })?;
    let templates = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListTemplatesResponse { templates }))
}

// ===========================================================================
// POST /v1/wachat/interactive-builder/templates
// ===========================================================================

#[instrument(skip_all)]
pub async fn save_template(
    user: AuthUser,
    State(state): State<WachatInteractiveBuilderState>,
    Json(body): Json<SaveTemplateBody>,
) -> Result<Json<Value>> {
    let uid = user_oid(&user)?;
    let project_id = body.project_id.trim();
    let name = body.name.trim();
    if project_id.is_empty() {
        return Err(ApiError::Validation("projectId is required.".to_owned()));
    }
    if name.is_empty() {
        return Err(ApiError::Validation("Template name is required.".to_owned()));
    }

    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "userId": uid,
        "projectId": project_id,
        "name": name,
        "payload": serde_value_to_bson(&body.payload),
        "createdAt": now,
        "updatedAt": now,
    };
    state
        .mongo
        .collection::<Document>(COLL)
        .insert_one(new_doc.clone())
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("interactive_templates.insert_one"))
        })?;
    Ok(Json(document_to_clean_json(new_doc)))
}

// ===========================================================================
// DELETE /v1/wachat/interactive-builder/templates/{id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn delete_template(
    user: AuthUser,
    State(state): State<WachatInteractiveBuilderState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let res = state
        .mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("interactive_templates.delete_one"))
        })?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Template not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}
