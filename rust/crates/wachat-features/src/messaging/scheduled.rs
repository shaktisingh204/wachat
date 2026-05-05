//! Scheduled messages.
//!
//! Mirrors `getScheduledMessages`, `scheduleMessage`, `cancelScheduledMessage`.

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

const COLL: &str = "wa_scheduled_messages";

#[derive(Debug, Serialize)]
pub struct MessagesResp {
    pub messages: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ScheduleBody {
    pub recipient_phone: String,
    pub message_text: String,
    pub scheduled_at: String,
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
) -> Result<Json<MessagesResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "scheduledAt": 1 })
        .build();
    let cursor = coll
        .find(doc! { "projectId": project.id, "status": { "$ne": "sent" } })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MessagesResp {
        messages: docs_to_json(docs),
    }))
}

pub async fn create(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<ScheduleBody>,
) -> Result<Json<MsgResp>> {
    if body.recipient_phone.trim().is_empty()
        || body.message_text.trim().is_empty()
        || body.scheduled_at.trim().is_empty()
    {
        return Err(ApiError::BadRequest("All fields are required.".to_owned()));
    }
    let scheduled = DateTime::parse_from_rfc3339(&body.scheduled_at)
        .map(|dt| dt.with_timezone(&Utc))
        .map_err(|_| ApiError::BadRequest("scheduledAt must be ISO 8601".to_owned()))?;
    if scheduled <= Utc::now() {
        return Err(ApiError::BadRequest(
            "Scheduled time must be in the future.".to_owned(),
        ));
    }
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.insert_one(doc! {
        "projectId": project.id,
        "recipientPhone": &body.recipient_phone,
        "messageText": &body.message_text,
        "scheduledAt": bson::DateTime::from_chrono(scheduled),
        "status": "pending",
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(MsgResp {
        message: "Message scheduled successfully.".to_owned(),
    }))
}

pub async fn cancel(
    _user: AuthUser,
    Path(message_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<OkResp>> {
    let oid = opt_oid(&message_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.update_one(
        doc! { "_id": oid },
        doc! { "$set": { "status": "cancelled" } },
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
