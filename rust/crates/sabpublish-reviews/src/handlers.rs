//! HTTP handlers for SabPublish reviews.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::{FindOptions, UpdateOptions};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{IngestReviewInput, IngestReviewResponse, ListQuery, ReplyReviewInput};
use crate::types::SabpublishReview;

const COLL: &str = "sabpublish_reviews";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabpublishReview>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_reviews(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(loc) = q.location_id.as_deref() {
        filter.insert("locationId", oid_from_str(loc)?);
    }
    if let Some(p) = q.provider_id.as_deref() {
        filter.insert("providerId", p);
    }
    if matches!(q.filter.as_deref(), Some("unreplied")) {
        filter.insert("replyBody", doc! { "$in": [null, ""] });
    }
    let limit = q.limit.unwrap_or(50).clamp(1, 500) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "postedAt": -1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<SabpublishReview>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("reviews.find")))?;
    let items: Vec<SabpublishReview> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("reviews.collect")))?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn ingest_review(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<IngestReviewInput>,
) -> Result<Json<IngestReviewResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&input.location_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let posted = Utc
        .timestamp_millis_opt(input.posted_at_ms)
        .single()
        .ok_or_else(|| ApiError::Validation("postedAtMs is invalid".to_owned()))?;

    let coll = mongo.collection::<SabpublishReview>(COLL);
    let filter = doc! {
        "userId": user_id,
        "locationId": loc,
        "providerId": &input.provider_id,
        "externalReviewId": &input.external_review_id,
    };
    let update = doc! {
        "$set": {
            "rating": input.rating as i32,
            "reviewerName": input.reviewer_name.clone(),
            "body": input.body.clone(),
            "postedAt": BsonDateTime::from_chrono(posted),
            "updatedAt": now,
        },
        "$setOnInsert": {
            "userId": user_id,
            "locationId": loc,
            "providerId": &input.provider_id,
            "externalReviewId": &input.external_review_id,
            "createdAt": now,
        },
    };
    coll.update_one(filter.clone(), update)
        .with_options(UpdateOptions::builder().upsert(true).build())
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("reviews.upsert")))?;
    let entity = coll
        .find_one(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("reviews.refetch")))?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("review upsert refetch empty")))?;
    let id = entity.id.map(|o| o.to_hex()).unwrap_or_default();
    Ok(Json(IngestReviewResponse { id, entity }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, review_id = %id))]
pub async fn reply_review(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(input): Json<ReplyReviewInput>,
) -> Result<Json<SabpublishReview>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    if input.reply_body.trim().is_empty() {
        return Err(ApiError::Validation("replyBody is required".to_owned()));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<SabpublishReview>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "replyBody": &input.reply_body,
                "repliedAt": now,
                "updatedAt": now,
            }},
        )
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("reviews.reply")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("review".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("reviews.refetch")))?
        .ok_or_else(|| ApiError::NotFound("review".to_owned()))?;
    Ok(Json(after))
}
