//! Recording handlers.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::{FindOneAndUpdateOptions, FindOptions, ReturnDocument};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{ListQuery, UpsertRecordingInput, UpsertRecordingResponse};
use crate::types::Recording;

const COLL: &str = "pagesense_recordings";

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<Recording>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %q.site_id))]
pub async fn list_recordings(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let site_id = oid_from_str(&q.site_id)?;
    let mut filter: Document = doc! { "userId": user_id, "siteId": site_id };
    if let Some(url) = q.url.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("urlPath", url);
    }
    if let Some(c) = q.country.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("country", c);
    }
    if let Some(min) = q.min_duration {
        filter.insert("durationSecs", doc! { "$gte": min as i64 });
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<Recording>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_recordings.find"))
    })?;
    let mut rows: Vec<Recording> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("pagesense_recordings.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, recording_id = %recording_id))]
pub async fn get_recording(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(recording_id): Path<String>,
) -> Result<Json<Recording>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&recording_id)?;
    let coll = mongo.collection::<Recording>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_recordings.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("recording".into()))?;
    Ok(Json(row))
}

/// Upsert by `(userId, siteId, sessionId)`. Called from the ingester
/// once a session is observed; idempotent so repeated batch flushes
/// don't insert duplicates.
#[instrument(skip_all, fields(user_id = %user.user_id, site_id = %input.site_id, session_id = %input.session_id))]
pub async fn upsert_recording(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<UpsertRecordingInput>,
) -> Result<Json<UpsertRecordingResponse>> {
    let user_id = user_oid(&user)?;
    let site_id = oid_from_str(&input.site_id)?;

    let started = Utc
        .timestamp_millis_opt(input.started_at_ms)
        .single()
        .ok_or_else(|| ApiError::Validation("invalid startedAtMs".into()))?;
    let ended = input
        .ended_at_ms
        .and_then(|ms| Utc.timestamp_millis_opt(ms).single());
    let events_file_id = input
        .events_file_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(oid_from_str)
        .transpose()?;

    let mut set = doc! {
        "userId": user_id,
        "siteId": site_id,
        "sessionId": &input.session_id,
        "startedAt": BsonDateTime::from_chrono(started),
        "durationSecs": input.duration_secs as i64,
        "urlPath": &input.url_path,
    };
    if let Some(e) = ended {
        set.insert("endedAt", BsonDateTime::from_chrono(e));
    }
    if let Some(ua) = &input.user_agent {
        set.insert("userAgent", ua);
    }
    if let Some(c) = &input.country {
        set.insert("country", c);
    }
    if let Some(f) = events_file_id {
        set.insert("eventsFileId", f);
    }

    let coll = mongo.collection::<Recording>(COLL);
    let opts = FindOneAndUpdateOptions::builder()
        .upsert(true)
        .return_document(ReturnDocument::After)
        .build();
    let row = coll
        .find_one_and_update(
            doc! { "userId": user_id, "siteId": site_id, "sessionId": &input.session_id },
            doc! {
                "$set": set,
                "$setOnInsert": { "createdAt": BsonDateTime::from_chrono(Utc::now()) },
            },
        )
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("pagesense_recordings.upsert"))
        })?
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("upsert returned no doc")))?;
    let id: ObjectId = row
        .id
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("recording missing _id")))?;
    Ok(Json(UpsertRecordingResponse { id: id.to_hex() }))
}
