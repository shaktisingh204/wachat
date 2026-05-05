//! Greeting message.
//!
//! Mirrors `getGreetingMessage`, `saveGreetingMessage`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
use mongodb::options::UpdateOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};

use crate::{state::WachatFeaturesState, tenancy::load_project_for};

const COLL: &str = "wa_greeting_config";

#[derive(Debug, Serialize)]
pub struct ConfigResp {
    pub config: Option<ConfigBody>,
}

#[derive(Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct ConfigBody {
    pub enabled: bool,
    pub message: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBody {
    pub enabled: bool,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
    pub message: String,
}

pub async fn get(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<ConfigResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let raw = coll
        .find_one(doc! { "projectId": project.id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    // Match the legacy `{ enabled: false, message: '' }` default when the
    // doc is missing (vs. returning null).
    let cfg = raw
        .map(|d| ConfigBody {
            enabled: d.get_bool("enabled").unwrap_or(false),
            message: d.get_str("message").unwrap_or("").to_owned(),
        })
        .unwrap_or_default();
    Ok(Json(ConfigResp { config: Some(cfg) }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SaveBody>,
) -> Result<Json<MsgResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let now = bson::DateTime::from_chrono(Utc::now());
    let opts = UpdateOptions::builder().upsert(true).build();
    coll.update_one(
        doc! { "projectId": project.id },
        doc! {
            "$set": {
                "enabled": body.enabled,
                "message": &body.message,
                "updatedAt": now,
            },
            "$setOnInsert": { "projectId": project.id, "createdAt": now },
        },
    )
    .with_options(opts)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MsgResp {
        message: "Greeting message saved.".to_owned(),
    }))
}
