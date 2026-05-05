//! Daily message volume + average response time.
//!
//! Mirrors `getMessageAnalytics`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{
    helpers::{doc_to_json, docs_to_json},
    state::WachatFeaturesState,
    tenancy::load_project_for,
};

#[derive(Debug, Deserialize)]
pub struct DaysQuery {
    #[serde(default)]
    pub days: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessagesAnalyticsResp {
    pub daily_data: Value,
    pub response_metrics: Value,
}

pub async fn report(
    user: AuthUser,
    Path(project_id): Path<String>,
    Query(qs): Query<DaysQuery>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<MessagesAnalyticsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let days = qs.days.unwrap_or(7);
    let since = Utc::now() - Duration::days(days);
    let since_b = bson::DateTime::from_chrono(since);

    let coll = state.mongo.collection::<Document>("messages");

    let daily_pipeline = vec![
        doc! { "$match": { "projectId": project.id, "timestamp": { "$gte": since_b } } },
        doc! { "$group": {
            "_id": {
                "date": { "$dateToString": { "format": "%Y-%m-%d", "date": "$timestamp" } },
                "direction": "$direction",
            },
            "count": { "$sum": 1 },
        } },
        doc! { "$sort": { "_id.date": 1 } },
    ];
    let daily_cursor = coll
        .aggregate(daily_pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let daily: Vec<Document> = daily_cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let resp_pipeline = vec![
        doc! { "$match": {
            "projectId": project.id,
            "direction": "out",
            "timestamp": { "$gte": since_b },
        } },
        doc! { "$group": {
            "_id": null,
            "avgResponseMs": { "$avg": "$responseTimeMs" },
            "count": { "$sum": 1 },
        } },
    ];
    let resp_cursor = coll
        .aggregate(resp_pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let resp: Vec<Document> = resp_cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let response_metrics = resp
        .into_iter()
        .next()
        .map(doc_to_json)
        .unwrap_or(Value::Object(serde_json::Map::new()));

    Ok(Json(MessagesAnalyticsResp {
        daily_data: docs_to_json(daily),
        response_metrics,
    }))
}
