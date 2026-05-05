//! Notification preferences (free-form bool map).
//!
//! Mirrors `getNotificationPreferences`, `saveNotificationPreferences`.

use std::collections::HashMap;

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use mongodb::options::UpdateOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::Serialize;
use serde_json::Value;

use crate::{helpers::doc_to_json, state::WachatFeaturesState, tenancy::load_project_for};

const COLL: &str = "wa_notification_prefs";

#[derive(Debug, Serialize)]
pub struct PrefsResp {
    pub prefs: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
    pub message: String,
}

pub async fn get(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<PrefsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let raw = coll
        .find_one(doc! { "projectId": project.id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(PrefsResp {
        prefs: raw.map(doc_to_json),
    }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(prefs): Json<HashMap<String, bool>>,
) -> Result<Json<MsgResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let now = bson::DateTime::from_chrono(Utc::now());

    let mut set_doc = Document::new();
    for (k, v) in prefs {
        set_doc.insert(k, v);
    }
    set_doc.insert("updatedAt", now);

    let opts = UpdateOptions::builder().upsert(true).build();
    coll.update_one(
        doc! { "projectId": project.id },
        doc! {
            "$set": set_doc,
            "$setOnInsert": { "projectId": project.id, "createdAt": now },
        },
    )
    .with_options(opts)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MsgResp {
        message: "Preferences saved.".to_owned(),
    }))
}
