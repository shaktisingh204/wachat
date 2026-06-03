//! Saved conversation filters (free-form `conditions` JSON).
//!
//! Mirrors `getConversationFilters`, `saveConversationFilter`,
//! `deleteConversationFilter`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, to_bson};
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

const COLL: &str = "wa_conversation_filters";

#[derive(Debug, Serialize)]
pub struct FiltersResp {
    pub filters: Value,
}

#[derive(Debug, Deserialize)]
pub struct SaveBody {
    pub name: String,
    #[serde(default)]
    pub conditions: Value,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
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
) -> Result<Json<FiltersResp>> {
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
    Ok(Json(FiltersResp {
        filters: docs_to_json(docs),
    }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SaveBody>,
) -> Result<Json<MsgResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let cond_bson = to_bson(&body.conditions)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("conditions encode")))?;
    coll.insert_one(doc! {
        "projectId": project.id,
        "name": &body.name,
        "conditions": cond_bson,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MsgResp {
        message: format!("Filter \"{}\" saved.", body.name),
    }))
}

pub async fn delete(
    _user: AuthUser,
    Path(filter_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&filter_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
