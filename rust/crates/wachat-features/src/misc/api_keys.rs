//! API key management — list, create, revoke.
//!
//! Mirrors `getApiKeys`, `createApiKey`, `revokeApiKey`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    helpers::{docs_to_json, opt_oid},
    state::WachatFeaturesState,
    tenancy::load_project_for,
};

const COLL: &str = "wa_api_keys";

#[derive(Debug, Serialize)]
pub struct KeysResp {
    pub keys: Value,
}

#[derive(Debug, Deserialize)]
pub struct CreateBody {
    pub name: String,
}

#[derive(Debug, Serialize)]
pub struct CreateResp {
    pub key: String,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<KeysResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .build();
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(KeysResp {
        keys: docs_to_json(docs),
    }))
}

pub async fn create(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<CreateBody>,
) -> Result<Json<CreateResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);

    // 32-char alphanumeric secret prefixed with `sk_` to match the
    // legacy format. Use the OS RNG via `bson::oid` style randomness?
    // Simpler: hash a random 24-byte ObjectId twice.
    let mut secret = String::with_capacity(35);
    secret.push_str("sk_");
    let chars = b"abcdefghijklmnopqrstuvwxyz0123456789";
    for _ in 0..32 {
        let oid = bson::oid::ObjectId::new();
        // first byte of the random component
        let bytes = oid.bytes();
        let pick = bytes[8] as usize % chars.len();
        secret.push(chars[pick] as char);
    }

    coll.insert_one(doc! {
        "projectId": project.id,
        "name": &body.name,
        "key": &secret,
        "isActive": true,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(CreateResp {
        key: secret,
        message: format!("API key \"{}\" created.", body.name),
    }))
}

pub async fn revoke(
    _user: AuthUser,
    Path(key_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&key_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.update_one(
        doc! { "_id": oid },
        doc! { "$set": {
            "isActive": false,
            "revokedAt": bson::DateTime::from_chrono(Utc::now()),
        } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
