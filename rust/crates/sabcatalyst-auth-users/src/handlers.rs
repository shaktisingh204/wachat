//! End-user identity HTTP handlers. The plaintext password never
//! reaches this crate — TS callers SHA-256 it before sending.

use axum::{Json, extract::{Path, Query, State}, http::StatusCode};
use bson::{Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::AUTH_USERS_COLL;
use crate::dto::{CreateAuthUserBody, ListAuthUsersQuery, ListAuthUsersResponse, MAX_LIMIT, UpdateAuthUserBody};
use crate::state::SabcatalystAuthUsersState;
use crate::types::AuthUserStatus;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn list_auth_users(
    user: AuthUser, State(state): State<SabcatalystAuthUsersState>,
    Query(q): Query<ListAuthUsersQuery>,
) -> Result<Json<ListAuthUsersResponse>> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&q.project_id)?;
    let mut filter = doc! { "userId": owner, "projectId": project };
    if let Some(term) = q.q.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("email", doc! { "$regex": term, "$options": "i" });
    }
    if let Some(c) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(c)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).limit(limit).build();
    let cur = state.mongo.collection::<Document>(AUTH_USERS_COLL)
        .find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("auth_users.find")))?;
    let docs: Vec<Document> = cur.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("auth_users.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit { None } else {
        docs.last().and_then(|d| d.get_object_id("_id").ok()).map(|o| o.to_hex())
    };
    Ok(Json(ListAuthUsersResponse {
        items: docs.into_iter().map(document_to_clean_json).collect(),
        next_cursor,
    }))
}

#[instrument(skip_all)]
pub async fn get_auth_user(
    user: AuthUser, State(state): State<SabcatalystAuthUsersState>, Path(id): Path<String>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let d = state.mongo.collection::<Document>(AUTH_USERS_COLL)
        .find_one(doc! { "_id": oid, "userId": owner }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("auth_users.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Auth user not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all)]
pub async fn create_auth_user(
    user: AuthUser, State(state): State<SabcatalystAuthUsersState>,
    Json(body): Json<CreateAuthUserBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    if body.email.trim().is_empty() || body.hashed_password.is_empty() {
        return Err(ApiError::BadRequest("email + hashedPassword required".into()));
    }
    let project = oid_from_str(&body.project_id)?;
    let coll = state.mongo.collection::<Document>(AUTH_USERS_COLL);
    let dup = coll.find_one(doc! { "projectId": project, "email": &body.email }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("auth_users.dup")))?;
    if dup.is_some() { return Err(ApiError::Conflict("email already exists".into())); }
    let now = Utc::now();
    let mut d = doc! {
        "_id": ObjectId::new(),
        "userId": owner, "projectId": project,
        "email": body.email.trim().to_lowercase(),
        "hashedPassword": body.hashed_password,
        "emailVerified": body.email_verified.unwrap_or(false),
        "status": "active",
        "createdAt": bson::DateTime::from_chrono(now),
        "updatedAt": bson::DateTime::from_chrono(now),
    };
    if let Some(m) = body.metadata_json {
        if let Ok(b) = to_bson(&m) { d.insert("metadataJson", b); }
    }
    coll.insert_one(&d).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("auth_users.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}

#[instrument(skip_all)]
pub async fn update_auth_user(
    user: AuthUser, State(state): State<SabcatalystAuthUsersState>, Path(id): Path<String>,
    Json(body): Json<UpdateAuthUserBody>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let mut set = doc! { "updatedAt": bson::DateTime::from_chrono(Utc::now()) };
    if let Some(v) = body.email { set.insert("email", v.trim().to_lowercase()); }
    if let Some(v) = body.hashed_password { set.insert("hashedPassword", v); }
    if let Some(v) = body.email_verified { set.insert("emailVerified", v); }
    if let Some(v) = body.status {
        let s = match v { AuthUserStatus::Active => "active", AuthUserStatus::Disabled => "disabled" };
        set.insert("status", s);
    }
    if let Some(m) = body.metadata_json {
        if let Ok(b) = to_bson(&m) { set.insert("metadataJson", b); }
    }
    let d = state.mongo.collection::<Document>(AUTH_USERS_COLL)
        .find_one_and_update(doc! { "_id": oid, "userId": owner }, doc! { "$set": set }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("auth_users.update")))?
        .ok_or_else(|| ApiError::NotFound("Auth user not found.".into()))?;
    Ok(Json(document_to_clean_json(d)))
}

#[instrument(skip_all)]
pub async fn delete_auth_user(
    user: AuthUser, State(state): State<SabcatalystAuthUsersState>, Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let r = state.mongo.collection::<Document>(AUTH_USERS_COLL)
        .delete_one(doc! { "_id": oid, "userId": owner }).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("auth_users.delete")))?;
    if r.deleted_count == 0 { return Err(ApiError::NotFound("Auth user not found.".into())); }
    Ok(StatusCode::NO_CONTENT)
}
