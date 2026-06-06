//! HTTP handlers for the wachat number-routing domain.
//!
//! All endpoints are scoped to the authenticated user (`userId`). The
//! `/wachat/two-line` page is the sole consumer today.
//!
//! | Endpoint                              | Action          |
//! |---------------------------------------|-----------------|
//! | `GET    /v1/wachat/number-routing`    | list bindings   |
//! | `POST   /v1/wachat/number-routing`    | create binding  |
//! | `PUT    /v1/wachat/number-routing/{id}` | update binding |
//! | `DELETE /v1/wachat/number-routing/{id}` | delete binding |

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::dto::{BindingBody, ListBindingsResponse, SuccessResponse};
use crate::state::WachatNumberRoutingState;

const COLL: &str = "wa_number_team_bindings";

/// Parse the JWT subject into an `ObjectId`, mapping failure to 401.
fn user_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))
}

/// Shared field validation for create / update.
fn validate(body: &BindingBody) -> Result<()> {
    if body.label.trim().is_empty() || body.phone_number_id.trim().is_empty() {
        return Err(ApiError::Validation(
            "Label and phone number are required.".to_owned(),
        ));
    }
    if body.default_route != "bot" && body.default_route != "agent" {
        return Err(ApiError::Validation(
            "defaultRoute must be 'bot' or 'agent'.".to_owned(),
        ));
    }
    Ok(())
}

/// Build the `teamId` BSON value from the optional string.
fn team_bson(team_id: &Option<String>) -> Bson {
    match team_id.as_deref().filter(|s| !s.is_empty()) {
        Some(t) => Bson::String(t.to_owned()),
        None => Bson::Null,
    }
}

// ===========================================================================
// GET /v1/wachat/number-routing
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_bindings(
    user: AuthUser,
    State(state): State<WachatNumberRoutingState>,
) -> Result<Json<ListBindingsResponse>> {
    let uid = user_oid(&user)?;
    let coll = state.mongo.collection::<Document>(COLL);
    let cursor = coll
        .find(doc! { "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("bindings.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("bindings.collect")))?;
    let bindings = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListBindingsResponse { bindings }))
}

// ===========================================================================
// POST /v1/wachat/number-routing
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_binding(
    user: AuthUser,
    State(state): State<WachatNumberRoutingState>,
    Json(body): Json<BindingBody>,
) -> Result<Json<Value>> {
    validate(&body)?;
    let uid = user_oid(&user)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let new_oid = ObjectId::new();
    let new_doc = doc! {
        "_id": new_oid,
        "userId": uid,
        "label": &body.label,
        "phoneNumberId": &body.phone_number_id,
        "teamId": team_bson(&body.team_id),
        "defaultRoute": &body.default_route,
        "createdAt": now,
        "updatedAt": now,
    };
    state
        .mongo
        .collection::<Document>(COLL)
        .insert_one(new_doc.clone())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("bindings.insert_one")))?;
    Ok(Json(document_to_clean_json(new_doc)))
}

// ===========================================================================
// PUT /v1/wachat/number-routing/{id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn update_binding(
    user: AuthUser,
    State(state): State<WachatNumberRoutingState>,
    Path(id): Path<String>,
    Json(body): Json<BindingBody>,
) -> Result<Json<SuccessResponse>> {
    validate(&body)?;
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = bson::DateTime::from_chrono(Utc::now());
    let res = state
        .mongo
        .collection::<Document>(COLL)
        .update_one(
            doc! { "_id": oid, "userId": uid },
            doc! { "$set": {
                "label": &body.label,
                "phoneNumberId": &body.phone_number_id,
                "teamId": team_bson(&body.team_id),
                "defaultRoute": &body.default_route,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("bindings.update_one")))?;
    if res.matched_count == 0 {
        return Err(ApiError::NotFound("Binding not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/wachat/number-routing/{id}
// ===========================================================================

#[instrument(skip_all)]
pub async fn delete_binding(
    user: AuthUser,
    State(state): State<WachatNumberRoutingState>,
    Path(id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let uid = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let res = state
        .mongo
        .collection::<Document>(COLL)
        .delete_one(doc! { "_id": oid, "userId": uid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("bindings.delete_one")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("Binding not found.".to_owned()));
    }
    Ok(Json(SuccessResponse::ok()))
}
