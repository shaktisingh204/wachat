//! Coarse message-volume statistics over a period.
//!
//! Mirrors `getMessageStatistics`.

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

use crate::{state::WachatFeaturesState, tenancy::load_project_for};

#[derive(Debug, Deserialize)]
pub struct PeriodQuery {
    #[serde(default)]
    pub period: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct StatsBody {
    pub total: u64,
    pub incoming: u64,
    pub outgoing: u64,
    pub media: u64,
}

#[derive(Debug, Serialize)]
pub struct StatsResp {
    pub stats: StatsBody,
}

pub async fn report(
    user: AuthUser,
    Path(project_id): Path<String>,
    Query(qs): Query<PeriodQuery>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<StatsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let period = qs.period.as_deref().unwrap_or("daily");
    let days = match period {
        "monthly" => 30,
        "weekly" => 7,
        _ => 1,
    };
    let since = bson::DateTime::from_chrono(Utc::now() - Duration::days(days));
    let messages = state.mongo.collection::<Document>("messages");

    let pipeline = vec![
        doc! { "$match": { "projectId": project.id, "timestamp": { "$gte": since } } },
        doc! { "$group": {
            "_id": {
                "direction": "$direction",
                "hasMedia": { "$cond": [
                    { "$in": ["$type", ["image", "video", "document", "audio"]] },
                    true, false,
                ] },
            },
            "count": { "$sum": 1 },
        } },
    ];
    let cursor = messages
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;

    let mut incoming: u64 = 0;
    let mut outgoing: u64 = 0;
    let mut media: u64 = 0;
    for d in docs {
        let id = d.get_document("_id").cloned().unwrap_or_default();
        let direction = id.get_str("direction").unwrap_or("");
        let has_media = id.get_bool("hasMedia").unwrap_or(false);
        let count = d.get_i32("count").unwrap_or(0) as u64;
        if direction == "in" {
            incoming += count;
        } else {
            outgoing += count;
        }
        if has_media {
            media += count;
        }
    }

    Ok(Json(StatsResp {
        stats: StatsBody {
            total: incoming + outgoing,
            incoming,
            outgoing,
            media,
        },
    }))
}
