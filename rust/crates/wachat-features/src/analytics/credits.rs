//! Credit-balance + 30-day daily usage.
//!
//! Mirrors `getCreditUsage`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::Serialize;
use serde_json::Value;

use crate::{helpers::docs_to_json, state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreditsResp {
    pub credits: f64,
    pub daily_usage: Value,
}

pub async fn usage(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<CreditsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let since = bson::DateTime::from_chrono(Utc::now() - Duration::days(30));

    let messages = state.mongo.collection::<Document>("messages");
    let pipeline = vec![
        doc! { "$match": {
            "projectId": project.id,
            "timestamp": { "$gte": since },
            "direction": "out",
        } },
        doc! { "$group": {
            "_id": { "$dateToString": { "format": "%Y-%m-%d", "date": "$timestamp" } },
            "count": { "$sum": 1 },
        } },
        doc! { "$sort": { "_id": 1 } },
    ];
    let cursor = messages
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(CreditsResp {
        credits: project.credits.unwrap_or(0.0),
        daily_usage: docs_to_json(docs),
    }))
}
