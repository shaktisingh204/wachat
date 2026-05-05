//! Chat satisfaction ratings.
//!
//! Mirrors `getChatRatings`, `submitChatRating`.

use axum::{
    Json,
    extract::{Path, State},
};
use bson::{Document, doc};
use chrono::Utc;
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

const COLL: &str = "wa_chat_ratings";

#[derive(Debug, Serialize)]
pub struct RatingsResp {
    pub ratings: Value,
    pub summary: Value,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SubmitBody {
    pub contact_id: String,
    pub rating: i32,
    #[serde(default)]
    pub feedback: Option<String>,
}

#[derive(Debug, Serialize)]
pub struct OkResp {
    pub success: bool,
}

pub async fn list(
    user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
) -> Result<Json<RatingsResp>> {
    let project = load_project_for(&user, &state.mongo, &project_id).await?;
    let coll = state.mongo.collection::<Document>(COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(100)
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

    let pipeline = vec![
        doc! { "$match": { "projectId": project.id } },
        doc! {
            "$group": {
                "_id": null,
                "avg": { "$avg": "$rating" },
                "count": { "$sum": 1 },
                "five": { "$sum": { "$cond": [{ "$eq": ["$rating", 5] }, 1, 0] } },
                "four": { "$sum": { "$cond": [{ "$eq": ["$rating", 4] }, 1, 0] } },
                "three": { "$sum": { "$cond": [{ "$eq": ["$rating", 3] }, 1, 0] } },
                "two":  { "$sum": { "$cond": [{ "$eq": ["$rating", 2] }, 1, 0] } },
                "one":  { "$sum": { "$cond": [{ "$eq": ["$rating", 1] }, 1, 0] } },
            }
        },
    ];
    let agg_cursor = coll
        .aggregate(pipeline)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let agg: Vec<Document> = agg_cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    let summary = agg
        .into_iter()
        .next()
        .map(|d| crate::helpers::doc_to_json(d))
        .unwrap_or(Value::Object(serde_json::Map::new()));

    Ok(Json(RatingsResp {
        ratings: docs_to_json(docs),
        summary,
    }))
}

pub async fn submit(
    _user: AuthUser,
    Path(project_id): Path<String>,
    State(state): State<WachatFeaturesState>,
    Json(body): Json<SubmitBody>,
) -> Result<Json<OkResp>> {
    let pid = opt_oid(&project_id)?;
    let coll = state.mongo.collection::<Document>(COLL);
    coll.insert_one(doc! {
        "projectId": pid,
        "contactId": &body.contact_id,
        "rating": body.rating,
        "feedback": body.feedback.unwrap_or_default(),
        "createdAt": bson::DateTime::from_chrono(Utc::now()),
    })
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e)))?;
    Ok(Json(OkResp { success: true }))
}
