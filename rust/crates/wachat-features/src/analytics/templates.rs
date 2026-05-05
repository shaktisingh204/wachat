//! Template-level send/delivery analytics.
//!
//! Mirrors `getTemplateAnalytics`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use serde::Serialize;
use serde_json::Value;

use crate::{helpers::docs_to_json, state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Serialize)]
pub struct AnalyticsResp {
    pub analytics: Value,
}

pub async fn report(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<AnalyticsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>("messages");

    let pipeline = vec![
        doc! { "$match": {
            "projectId": project.id,
            "direction": "out",
            "type": "template",
        } },
        doc! { "$group": {
            "_id": "$content.templateName",
            "sent": { "$sum": 1 },
            "delivered": { "$sum": { "$cond": [
                { "$in": ["$status", ["delivered", "read"]] }, 1, 0
            ] } },
            "read": { "$sum": { "$cond": [
                { "$eq": ["$status", "read"] }, 1, 0
            ] } },
            "failed": { "$sum": { "$cond": [
                { "$eq": ["$status", "failed"] }, 1, 0
            ] } },
        } },
        doc! { "$sort": { "sent": -1 } },
    ];
    let cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    Ok(Json(AnalyticsResp {
        analytics: docs_to_json(docs),
    }))
}
