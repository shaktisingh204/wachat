use axum::{
    Json,
    extract::{Path, Query, State},
    http::StatusCode,
};
use bson::{Document, doc, oid::ObjectId, to_bson};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use serde_json::Value;
use tracing::instrument;

use crate::API_KEYS_COLL;
use crate::dto::{CreateKeyBody, ListKeysQuery, ListKeysResponse, LookupKeyBody, MAX_LIMIT};
use crate::state::SabcatalystApiKeysState;
use crate::types::ApiKeyScope;

fn owner_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim not a valid ObjectId".into()))
}

#[instrument(skip_all)]
pub async fn list_keys(
    user: AuthUser,
    State(state): State<SabcatalystApiKeysState>,
    Query(q): Query<ListKeysQuery>,
) -> Result<Json<ListKeysResponse>> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&q.project_id)?;
    let mut filter = doc! { "userId": owner, "projectId": project };
    if let Some(c) = q.cursor.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("_id", doc! { "$lt": oid_from_str(c)? });
    }
    let limit = q.limit.clamp(1, MAX_LIMIT);
    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();
    let cur = state
        .mongo
        .collection::<Document>(API_KEYS_COLL)
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.find")))?;
    let docs: Vec<Document> = cur
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.collect")))?;
    let next_cursor = if (docs.len() as i64) < limit {
        None
    } else {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    };
    Ok(Json(ListKeysResponse {
        items: docs.into_iter().map(document_to_clean_json).collect(),
        next_cursor,
    }))
}

#[instrument(skip_all)]
pub async fn create_key(
    user: AuthUser,
    State(state): State<SabcatalystApiKeysState>,
    Json(body): Json<CreateKeyBody>,
) -> Result<(StatusCode, Json<Value>)> {
    let owner = owner_oid(&user)?;
    if body.label.trim().is_empty() || body.key_hash.is_empty() {
        return Err(ApiError::BadRequest("label + keyHash required".into()));
    }
    let project = oid_from_str(&body.project_id)?;
    let scope = body.scope.unwrap_or(ApiKeyScope::Write);
    let scope_bson = to_bson(&scope).unwrap_or_else(|_| bson::Bson::String("write".into()));
    let mut d = doc! {
        "_id": ObjectId::new(),
        "userId": owner, "projectId": project,
        "label": body.label.trim(),
        "keyHash": body.key_hash,
        "scope": scope_bson,
        "status": "active",
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    };
    if let Some(e) = body.expires_at {
        d.insert("expiresAt", bson::DateTime::from_chrono(e));
    }
    state
        .mongo
        .collection::<Document>(API_KEYS_COLL)
        .insert_one(&d)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.insert")))?;
    Ok((StatusCode::CREATED, Json(document_to_clean_json(d))))
}

#[instrument(skip_all)]
pub async fn revoke_key(
    user: AuthUser,
    State(state): State<SabcatalystApiKeysState>,
    Path(id): Path<String>,
) -> Result<StatusCode> {
    let owner = owner_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let r = state
        .mongo
        .collection::<Document>(API_KEYS_COLL)
        .update_one(
            doc! { "_id": oid, "userId": owner },
            doc! { "$set": { "status": "revoked" } },
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.revoke")))?;
    if r.matched_count == 0 {
        return Err(ApiError::NotFound("API key not found.".into()));
    }
    Ok(StatusCode::NO_CONTENT)
}

/// Service-to-service lookup used by the TS runtime route handler at
/// `/api/catalyst/[projectSlug]/functions/[functionName]` to validate
/// an incoming API key. Caller is the SabNode JWT, scoped to the owner.
#[instrument(skip_all)]
pub async fn lookup_key(
    user: AuthUser,
    State(state): State<SabcatalystApiKeysState>,
    Json(body): Json<LookupKeyBody>,
) -> Result<Json<Value>> {
    let owner = owner_oid(&user)?;
    let project = oid_from_str(&body.project_id)?;
    let d = state
        .mongo
        .collection::<Document>(API_KEYS_COLL)
        .find_one(doc! {
            "userId": owner, "projectId": project,
            "keyHash": &body.key_hash,
            "status": "active",
        })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("api_keys.lookup")))?
        .ok_or_else(|| ApiError::Unauthorized("invalid API key".into()))?;
    Ok(Json(document_to_clean_json(d)))
}
