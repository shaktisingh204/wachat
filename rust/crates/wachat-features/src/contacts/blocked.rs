//! Blocked contacts.
//!
//! Mirrors `getBlockedContacts`, `blockContact`, `unblockContact`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::{FindOptions, UpdateOptions};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    helpers::{docs_to_json, opt_oid},
    state::WachatFeaturesState,
    tenancy::load_project_for,
};

const COLL: &str = "wa_blocked_contacts";

#[derive(Debug, Serialize)]
pub struct ContactsResp {
    pub contacts: Value,
}

#[derive(Debug, Deserialize)]
pub struct AddBody {
    pub phone: String,
    #[serde(default)]
    pub reason: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<ContactsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "blockedAt": -1 })
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
    Ok(Json(ContactsResp {
        contacts: docs_to_json(docs),
    }))
}

pub async fn add(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<AddBody>,
) -> Result<Json<OkResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = UpdateOptions::builder().upsert(true).build();
    coll.update_one(
        doc! { "projectId": project.id, "phone": &body.phone },
        doc! {
            "$set": {
                "reason": body.reason.unwrap_or_default(),
                "blockedAt": bson::DateTime::from_chrono(Utc::now()),
            },
            "$setOnInsert": { "projectId": project.id, "phone": &body.phone },
        },
    )
    .with_options(opts)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}

pub async fn remove(
    _user: AuthUser,
    Path(blocked_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&blocked_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
