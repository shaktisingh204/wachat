//! Business-hours configuration.
//!
//! Mirrors `getBusinessHours`, `saveBusinessHours`. The legacy code stored
//! `schedule` as an arbitrary JSON object — preserved here as
//! `serde_json::Value` so any shape the front-end posts round-trips.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc, to_bson};
use chrono::Utc;
use mongodb::options::UpdateOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{helpers::doc_to_json, state::WachatFeaturesState, tenancy::load_project_for};

const COLL: &str = "wa_business_hours";

#[derive(Debug, Serialize)]
pub struct HoursResp {
    pub hours: Option<Value>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveBody {
    #[serde(default)]
    pub timezone: Option<String>,
    #[serde(default)]
    pub offline_message: Option<String>,
    #[serde(default)]
    pub schedule: Option<Value>,
    #[serde(default)]
    pub holidays: Option<Value>,
}

#[derive(Debug, Serialize)]
pub struct MsgResp {
    pub message: String,
}

pub async fn get(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<HoursResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let hours = coll
        .find_one(doc! { "projectId": project.id })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(HoursResp {
        hours: hours.map(doc_to_json),
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
    let now = bson::DateTime::from_chrono(Utc::now());

    let schedule = body.schedule.unwrap_or(Value::Object(Default::default()));
    let schedule_bson = to_bson(&schedule)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("schedule encode")))?;

    let holidays = body.holidays.unwrap_or(Value::Array(vec![]));
    let holidays_bson = to_bson(&holidays)
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("holidays encode")))?;

    let opts = UpdateOptions::builder().upsert(true).build();
    coll.update_one(
        doc! { "projectId": project.id },
        doc! {
            "$set": {
                "timezone": body.timezone.unwrap_or_else(|| "UTC".to_owned()),
                "offlineMessage": body.offline_message.unwrap_or_default(),
                "schedule": schedule_bson,
                "holidays": holidays_bson,
                "updatedAt": now,
            },
            "$setOnInsert": { "projectId": project.id, "createdAt": now },
        },
    )
    .with_options(opts)
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(MsgResp {
        message: "Business hours saved.".to_owned(),
    }))
}
