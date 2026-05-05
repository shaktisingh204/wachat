//! Away message + schedule.
//!
//! Mirrors `getAwayMessage`, `saveAwayMessage`.

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

const COLL: &str = "wa_away_config";

#[derive(Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigBody {
    pub enabled: bool,
    pub message: String,
    pub schedule: String,
    #[serde(default)]
    pub time_from: Option<String>,
    #[serde(default)]
    pub time_to: Option<String>,
}

impl Default for ConfigBody {
    fn default() -> Self {
        Self {
            enabled: false,
            message: String::new(),
            schedule: "always".to_owned(),
            time_from: None,
            time_to: None,
        }
    }
}

#[derive(Debug, Serialize)]
pub struct ConfigResp {
    pub config: Option<ConfigBody>,
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
    let cfg = raw
        .map(|d| ConfigBody {
            enabled: d.get_bool("enabled").unwrap_or(false),
            message: d.get_str("message").unwrap_or("").to_owned(),
            schedule: d.get_str("schedule").unwrap_or("always").to_owned(),
            time_from: d.get_str("timeFrom").ok().map(|s| s.to_owned()),
            time_to: d.get_str("timeTo").ok().map(|s| s.to_owned()),
        })
        .unwrap_or_default();
    Ok(Json(ConfigResp { config: Some(cfg) }))
}

pub async fn save(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<ConfigBody>,
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
                "schedule": &body.schedule,
                "timeFrom": body.time_from.unwrap_or_default(),
                "timeTo": body.time_to.unwrap_or_default(),
                "updatedAt": now,
            },
            "$setOnInsert": { "projectId": project.id, "createdAt": now },
        },
    )
    .with_options(opts)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MsgResp {
        message: "Away message saved.".to_owned(),
    }))
}
