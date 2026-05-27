use axum::{Json, extract::{Path, Query, State}, http::StatusCode};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::SESSIONS_COLL;
use crate::dto::{IssueSessionBody, ListSessionsQuery, ListSessionsResponse, MAX_LIMIT};
use crate::state::SabcatalystAuthSessionsState;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn list_sessions(
    user: AuthUser, State(state): State<SabcatalystAuthSessionsState>,
    Query(q): Query<ListSessionsQuery>,
) -> Result<Json<ListSessionsResponse>> {
    let owner = owner_oid(&user)?;
    let mut filter = doc! { "userId": owner };
    if let Some(p) = q.project_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("projectId", oid_from_str(p)?);
    }
    if let Some(u) = q.auth_user_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("authUserId", oid_from_str(u)?);
    }
    if let Some(c) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(c)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder().sort(doc! { "_id": -1 }).limit(limit).build();
    let cur = state.mongo.collection::<Document>(SESSIONS_COLL)
        .find(filter).with_options(opts).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sessions.find")))?;
    let docs: Vec<Document> = cur.try_collect().await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sessions.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit { None } else {
        docs.last().and_then(|d| d.get_object_id("_id").ok()).map(|o| o.to_hex())
    };
    Ok(Json(ListSessionsResponse {
        items: docs.into_iter().map(document_to_clean_json).collect(),
        next_cursor,
    }))
}

#[instrument(skip_all)]
pub async fn issue_session(
    user: AuthUser, State(state): State<SabcatalystAuthSessionsState>,
    Json(body): Json<IssueSessionBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    let auth_user = oid_from_str(&body.auth_user_id)?;
    let project = oid_from_str(&body.project_id)?;
    let d = doc! {
        "_id": ObjectId::new(),
        "userId": owner, "projectId": project, "authUserId": auth_user,
        "tokenHash": body.token_hash,
        "expiresAt": bson::DateTime::from_chrono(body.expires_at),
        "revoked": false,
        "ip": body.ip,
        "userAgent": body.user_agent,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    };
    state.mongo.collection::<Document>(SESSIONS_COLL).insert_one(&d).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sessions.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}

#[instrument(skip_all)]
pub async fn revoke_session(
    user: AuthUser, State(state): State<SabcatalystAuthSessionsState>, Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let r = state.mongo.collection::<Document>(SESSIONS_COLL)
        .update_one(
            doc! { "_id": oid, "userId": owner },
            doc! { "$set": { "revoked": true } },
        ).await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sessions.revoke")))?;
    if r.matched_count == 0 { return Err(ApiError::NotFound("Session not found.".into())); }
    Ok(StatusCode::NO_CONTENT)
}
