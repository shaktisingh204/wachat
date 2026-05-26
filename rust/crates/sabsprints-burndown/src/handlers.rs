//! HTTP handlers for burndown samples.

use axum::{
    Json,
    extract::{Query, State},
};
use bson::{DateTime as BsonDateTime, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{ListQuery, RecordSampleInput, RecordSampleResponse};
use crate::types::AgileBurndownSample;

const COLL: &str = "agile_burndown";

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<AgileBurndownSample>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_burndown(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let sprint_id = ObjectId::parse_str(q.sprint_id.trim())
        .map_err(|_| ApiError::Validation("sprintId must be a valid ObjectId".to_owned()))?;
    let filter = doc! { "userId": user_id, "sprintId": sprint_id };
    let opts = FindOptions::builder().sort(doc! { "day": 1 }).build();
    let coll = mongo.collection::<AgileBurndownSample>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("agile_burndown.find"))
    })?;
    let rows: Vec<AgileBurndownSample> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("agile_burndown.collect"))
    })?;
    Ok(Json(ListResponse { items: rows }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn record_sample(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<RecordSampleInput>,
) -> Result<Json<RecordSampleResponse>> {
    let user_id = user_oid(&user)?;
    let sprint_id = ObjectId::parse_str(input.sprint_id.trim())
        .map_err(|_| ApiError::Validation("sprintId must be a valid ObjectId".to_owned()))?;
    let sample_date = input
        .sample_date
        .as_deref()
        .and_then(parse_date)
        .unwrap_or_else(|| BsonDateTime::from_chrono(Utc::now()));
    let entity = AgileBurndownSample {
        id: None,
        user_id,
        sprint_id,
        day: input.day,
        sample_date,
        remaining_points: input.remaining_points,
        created_at: BsonDateTime::from_chrono(Utc::now()),
    };
    let coll = mongo.collection::<AgileBurndownSample>(COLL);
    // Upsert per (sprintId, day) so re-sampling the same day overwrites.
    let filter = doc! { "userId": user_id, "sprintId": sprint_id, "day": input.day as i64 };
    let update = doc! { "$set": {
        "userId": user_id,
        "sprintId": sprint_id,
        "day": input.day as i64,
        "sampleDate": sample_date,
        "remainingPoints": input.remaining_points,
    }, "$setOnInsert": {
        "createdAt": BsonDateTime::from_chrono(Utc::now()),
    }};
    let result = coll
        .update_one(filter, update)
        .upsert(true)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("agile_burndown.upsert"))
        })?;
    let new_id = result
        .upserted_id
        .and_then(|b| b.as_object_id())
        .unwrap_or_else(ObjectId::new);
    let mut entity = entity;
    entity.id = Some(new_id);
    Ok(Json(RecordSampleResponse {
        id: new_id.to_hex(),
        entity,
    }))
}
