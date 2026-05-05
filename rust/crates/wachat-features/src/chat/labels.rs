//! Chat-label CRUD + per-contact assignment.
//!
//! Mirrors `getChatLabels`, `saveChatLabel`, `deleteChatLabel`,
//! `assignLabelToContact`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, oid::ObjectId};
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

const COLL: &str = "wa_chat_labels";

#[derive(Debug, Serialize)]
pub struct LabelsResp {
    pub labels: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveLabelBody {
    pub name: String,
    #[serde(default)]
    pub color: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct SaveLabelResp {
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
) -> Result<Json<LabelsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder().sort(doc! { "name": 1 }).build();
    let cursor = coll
        .find(doc! { "projectId": project.id })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(LabelsResp {
        labels: docs_to_json(docs),
    }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SaveLabelBody>,
) -> Result<Json<SaveLabelResp>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("Label name is required.".to_owned()));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let color = body.color.unwrap_or_else(|| "#3b82f6".to_owned());
    coll.insert_one(doc! {
        "projectId": project.id,
        "name": &body.name,
        "color": &color,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(SaveLabelResp {
        message: format!("Label \"{}\" created.", body.name),
    }))
}

pub async fn delete(
    _user: AuthUser,
    Path(label_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid: ObjectId = opt_oid(&label_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}

pub async fn assign(
    _user: AuthUser,
    Path((contact_id, label_id)): Path<(String, String)>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let coid = opt_oid(&contact_id)?;
    let coll = state.mongo.collection::<Document>("contacts");
    coll.update_one(
        doc! { "_id": coid },
        doc! { "$addToSet": { "labelIds": label_id } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
