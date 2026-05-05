//! Scheduled broadcasts.
//!
//! Mirrors `getScheduledBroadcasts`, `scheduleBroadcast`, `cancelScheduledBroadcast`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::{DateTime, Utc};
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

const COLL: &str = "wa_scheduled_broadcasts";

#[derive(Debug, Serialize)]
pub struct SchedulesResp {
    pub schedules: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateBody {
    pub name: String,
    pub template_name: String,
    #[serde(default)]
    pub audience: Option<String>,
    pub scheduled_at: String,
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub recurring: Option<String>,
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
) -> Result<Json<SchedulesResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "scheduledAt": 1 })
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
    Ok(Json(SchedulesResp {
        schedules: docs_to_json(docs),
    }))
}

pub async fn create(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<CreateBody>,
) -> Result<Json<MsgResp>> {
    if body.name.trim().is_empty()
        || body.template_name.trim().is_empty()
        || body.scheduled_at.trim().is_empty()
    {
        return Err(ApiError::BadRequest("All fields required.".to_owned()));
    }
    let scheduled = DateTime::parse_from_rfc3339(&body.scheduled_at)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| ApiError::BadRequest("scheduledAt must be ISO 8601".to_owned()))?;
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.insert_one(doc! {
        "projectId": project.id,
        "name": &body.name,
        "templateName": &body.template_name,
        "audience": body.audience.unwrap_or_else(|| "all".to_owned()),
        "scheduledAt": bson::DateTime::from_chrono(scheduled),
        "timezone": body.timezone.unwrap_or_else(|| "UTC".to_owned()),
        "recurring": body.recurring.unwrap_or_else(|| "none".to_owned()),
        "status": "scheduled",
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MsgResp {
        message: "Broadcast scheduled.".to_owned(),
    }))
}

pub async fn cancel(
    _user: AuthUser,
    Path(schedule_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&schedule_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.update_one(
        doc! { "_id": oid },
        doc! { "$set": { "status": "cancelled" } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
