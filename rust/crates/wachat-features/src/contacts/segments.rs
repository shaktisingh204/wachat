//! Broadcast segments.
//!
//! Mirrors `getBroadcastSegments`, `saveBroadcastSegment`, `deleteBroadcastSegment`.

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

const COLL: &str = "wa_broadcast_segments";

#[derive(Debug, Serialize)]
pub struct SegmentsResp {
    pub segments: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBody {
    pub name: String,
    #[serde(default)]
    pub filter_tags: Option<String>,
    #[serde(default)]
    pub filter_last_active: Option<String>,
    #[serde(default)]
    pub filter_city: Option<String>,
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
) -> Result<Json<SegmentsResp>> {
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
    Ok(Json(SegmentsResp {
        segments: docs_to_json(docs),
    }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SaveBody>,
) -> Result<Json<MsgResp>> {
    if body.name.trim().is_empty() {
        return Err(ApiError::BadRequest("Segment name is required.".to_owned()));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);

    let mut filters = Document::new();
    if let Some(tags) = body.filter_tags.as_deref().filter(|s| !s.is_empty()) {
        let list: Vec<String> = tags
            .split(',')
            .map(|t| t.trim().to_owned())
            .filter(|t| !t.is_empty())
            .collect();
        filters.insert("tags", list);
    }
    if let Some(la) = body.filter_last_active.as_deref().filter(|s| !s.is_empty()) {
        filters.insert("lastActive", la);
    }
    if let Some(c) = body.filter_city.as_deref().filter(|s| !s.is_empty()) {
        filters.insert("city", c);
    }

    coll.insert_one(doc! {
        "projectId": project.id,
        "name": &body.name,
        "filters": filters,
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(MsgResp {
        message: format!("Segment \"{}\" created.", body.name),
    }))
}

pub async fn delete(
    _user: AuthUser,
    Path(segment_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&segment_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
