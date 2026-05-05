//! Saved (canned) replies.
//!
//! Mirrors `getSavedReplies`, `saveSavedReply`, `deleteSavedReply`.

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

const COLL: &str = "wa_saved_replies";

#[derive(Debug, Serialize)]
pub struct RepliesResp {
    pub replies: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBody {
    #[serde(default)]
    pub reply_id: Option<String>,
    pub shortcut: String,
    #[serde(default)]
    pub title: Option<String>,
    pub body: String,
    #[serde(default)]
    pub category: Option<String>,
    #[serde(default)]
    pub media_url: Option<String>,
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
) -> Result<Json<RepliesResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "category": 1, "shortcut": 1 })
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
    Ok(Json(RepliesResp {
        replies: docs_to_json(docs),
    }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SaveBody>,
) -> Result<Json<MsgResp>> {
    if body.shortcut.trim().is_empty() || body.body.trim().is_empty() {
        return Err(ApiError::BadRequest(
            "Shortcut and body are required.".to_owned(),
        ));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let shortcut = if body.shortcut.starts_with('/') {
        body.shortcut.clone()
    } else {
        format!("/{}", body.shortcut)
    };
    let title = body.title.clone().unwrap_or_else(|| body.shortcut.clone());
    let now = bson::DateTime::from_chrono(Utc::now());

    let mut set_doc = doc! {
        "projectId": project.id,
        "shortcut": shortcut,
        "title": title,
        "body": &body.body,
        "category": body.category.unwrap_or_else(|| "General".to_owned()),
        "mediaUrl": body.media_url.unwrap_or_default(),
        "updatedAt": now,
    };

    if let Some(rid) = body.reply_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = opt_oid(rid)?;
        coll.update_one(doc! { "_id": oid }, doc! { "$set": set_doc })
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    } else {
        set_doc.insert("createdAt", now);
        coll.insert_one(set_doc)
            .await
            .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    }

    Ok(Json(MsgResp {
        message: "Reply saved.".to_owned(),
    }))
}

pub async fn delete(
    _user: AuthUser,
    Path(reply_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&reply_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.delete_one(doc! { "_id": oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
