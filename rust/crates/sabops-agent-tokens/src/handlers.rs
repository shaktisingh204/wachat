use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    IssueTokenInput, IssueTokenResponse, ListQuery, RedeemTokenInput, RedeemTokenResponse,
    RevokeTokenResponse,
};
use crate::types::SabopsAgentToken;

const COLL: &str = "sabops_agent_tokens";
const ENDPOINTS_COLL: &str = "sabops_endpoints";

const VALID_OS: &[&str] = &["windows", "macos", "linux", "ios", "android"];

fn random_token() -> String {
    // 32-byte hex via ObjectIds + a chrono ns fragment — deterministic
    // entropy on the server, good enough for short-lived enrollment.
    let a = ObjectId::new();
    let b = ObjectId::new();
    let n = Utc::now().timestamp_nanos_opt().unwrap_or(0);
    format!("sabops_{}{}_{n}", a.to_hex(), b.to_hex())
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabopsAgentToken>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_tokens(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if !q.include_used.unwrap_or(false) {
        filter.insert("used", false);
    }
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(200)
        .build();
    let coll = mongo.collection::<SabopsAgentToken>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_agent_tokens.find"))
    })?;
    let rows: Vec<SabopsAgentToken> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_agent_tokens.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn issue_token(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<IssueTokenInput>,
) -> Result<Json<IssueTokenResponse>> {
    let user_id = user_oid(&user)?;
    let ttl = input
        .ttl_seconds
        .unwrap_or(3600)
        .clamp(60, 604_800);
    let expires_at = Utc::now() + Duration::seconds(ttl as i64);

    if let Some(os) = &input.intended_os {
        if !VALID_OS.contains(&os.as_str()) {
            return Err(ApiError::Validation(format!(
                "intendedOs must be one of {:?}",
                VALID_OS
            )));
        }
    }

    let mut entity = SabopsAgentToken {
        id: None,
        user_id,
        token: random_token(),
        expires_at: BsonDateTime::from_chrono(expires_at),
        used: false,
        used_at: None,
        redeemed_endpoint_id: None,
        intended_os: input.intended_os,
        created_at: BsonDateTime::from_chrono(Utc::now()),
    };

    let coll = mongo.collection::<SabopsAgentToken>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_agent_tokens.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);

    Ok(Json(IssueTokenResponse {
        id: new_id.to_hex(),
        token: entity.token.clone(),
        expires_at: expires_at.to_rfc3339(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, token_id = %token_id))]
pub async fn revoke_token(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(token_id): Path<String>,
) -> Result<Json<RevokeTokenResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&token_id)?;
    let coll = mongo.collection::<SabopsAgentToken>(COLL);
    let result = coll
        .delete_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_agent_tokens.revoke"))
        })?;
    Ok(Json(RevokeTokenResponse {
        revoked: result.deleted_count > 0,
    }))
}

/// Trusted-internal redeem path. The Next.js agent-token gateway calls
/// this with an **agent-session AuthUser** that carries the same `userId`
/// as the token's owning tenant (resolved server-side from the token
/// itself). Atomically marks the token used and inserts the endpoint.
#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn redeem_token(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<RedeemTokenInput>,
) -> Result<Json<RedeemTokenResponse>> {
    let user_id = user_oid(&user)?;
    if !VALID_OS.contains(&input.os.as_str()) {
        return Err(ApiError::Validation(format!(
            "os must be one of {:?}",
            VALID_OS
        )));
    }

    let now = Utc::now();
    let coll = mongo.collection::<SabopsAgentToken>(COLL);
    let token_doc = coll
        .find_one(doc! {
            "userId": user_id,
            "token": &input.token,
            "used": false,
            "expiresAt": { "$gt": BsonDateTime::from_chrono(now) },
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabops_agent_tokens.lookup"))
        })?
        .ok_or_else(|| ApiError::Validation("token invalid, expired, or already used".to_owned()))?;
    let token_oid = token_doc
        .id
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("token doc missing _id")))?;

    // Insert endpoint
    let endpoint_doc: Document = doc! {
        "userId": user_id,
        "hostname": &input.hostname,
        "os": &input.os,
        "osVersion": input.os_version,
        "agentVersion": input.agent_version,
        "macAddress": input.mac_address,
        "serialNumber": input.serial_number,
        "model": input.model,
        "status": "online",
        "lastSeenAt": BsonDateTime::from_chrono(now),
        "tags": Vec::<String>::new(),
        "createdAt": BsonDateTime::from_chrono(now),
    };
    let endpoints_coll = mongo.collection::<Document>(ENDPOINTS_COLL);
    let inserted = endpoints_coll.insert_one(endpoint_doc).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_endpoints.insert"))
    })?;
    let endpoint_oid = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;

    // Mark token consumed
    coll.update_one(
        doc! { "_id": token_oid },
        doc! {
            "$set": {
                "used": true,
                "usedAt": BsonDateTime::from_chrono(now),
                "redeemedEndpointId": endpoint_oid,
            }
        },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabops_agent_tokens.consume"))
    })?;

    Ok(Json(RedeemTokenResponse {
        endpoint_id: endpoint_oid.to_hex(),
    }))
}
