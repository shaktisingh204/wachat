//! Delivery report — outbound stats by status + recent failures.
//!
//! Mirrors `getDeliveryReport`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;

use crate::{helpers::docs_to_json, state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Deserialize)]
pub struct DaysQuery {
    #[serde(default)]
    pub days: Option<i64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeliveryResp {
    pub stats: Value,
    pub failed_messages: Value,
}

pub async fn report(
    user: AuthUser,
    Path(project_id): Path<String>,
    Query(qs): Query<DaysQuery>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<DeliveryResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let days = qs.days.unwrap_or(7);
    let since = bson::DateTime::from_chrono(Utc::now() - Duration::days(days));
    let messages = state.mongo.collection::<Document>("messages");

    let pipeline = vec![
        doc! { "$match": {
            "projectId": project.id,
            "direction": "out",
            "timestamp": { "$gte": since },
        } },
        doc! { "$group": { "_id": "$status", "count": { "$sum": 1 } } },
    ];
    let cursor = messages
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let stats: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let opts = FindOptions::builder()
        .sort(doc! { "timestamp": -1 })
        .limit(20)
        .build();
    let fcursor = messages
        .find(doc! {
            "projectId": project.id,
            "direction": "out",
            "status": "failed",
            "timestamp": { "$gte": since },
        })
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let failed: Vec<Document> = fcursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(DeliveryResp {
        stats: docs_to_json(stats),
        failed_messages: docs_to_json(failed),
    }))
}
