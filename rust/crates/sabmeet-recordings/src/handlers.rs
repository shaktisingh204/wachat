//! HTTP handlers for SabMeet recordings.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    pagination::{clamp_limit, skip_for},
    tenant::user_oid,
};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CompleteRecordingInput, CreateRecordingResponse, DeleteRecordingResponse, FailRecordingInput,
    ListQuery, ListResponse, StartRecordingInput,
};
use crate::types::Recording;

const COLL: &str = "meet_recordings";
const STATUS_VARIANTS: &[&str] = &["recording", "processing", "ready", "failed"];

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_recordings(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(r) = q
        .room_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("roomId", r);
    }
    if let Some(s) = q.status.as_deref().filter(|s| STATUS_VARIANTS.contains(s)) {
        filter.insert("status", s);
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
        ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.find"))
    })?;
    let mut rows: Vec<Recording> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn start_recording(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<StartRecordingInput>,
) -> Result<Json<CreateRecordingResponse>> {
    let user_id = user_oid(&user)?;
    let room_id = ObjectId::parse_str(&input.room_id)
        .map_err(|_| ApiError::Validation("roomId must be a valid ObjectId".to_owned()))?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = Recording {
        id: None,
        user_id,
        room_id,
        started_at: now,
        ended_at: None,
        duration_secs: None,
        file_id: None,
        audio_file_id: None,
        transcript_file_id: None,
        transcript: vec![],
        status: "recording".to_owned(),
        error_message: None,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<Recording>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateRecordingResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rec_id))]
pub async fn complete_recording(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rec_id): Path<String>,
    Json(input): Json<CompleteRecordingInput>,
) -> Result<Json<Recording>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rec_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Recording>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("recording".to_owned()))?;
    let duration = input.duration_secs.unwrap_or_else(|| {
        ((now.timestamp_millis() - before.started_at.timestamp_millis()) / 1000).max(0) as u32
    });

    let mut set = doc! {
        "status": "ready",
        "endedAt": now,
        "durationSecs": duration,
        "fileId": input.file_id,
        "updatedAt": now,
    };
    if let Some(v) = input.audio_file_id {
        set.insert("audioFileId", v);
    }
    if let Some(v) = input.transcript_file_id {
        set.insert("transcriptFileId", v);
    }
    if let Some(v) = input.transcript {
        let cues = bson::to_bson(&v).map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.transcript.bson"))
        })?;
        set.insert("transcript", cues);
    }
    coll.update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.update"))
        })?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("recording".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rec_id))]
pub async fn fail_recording(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rec_id): Path<String>,
    Json(input): Json<FailRecordingInput>,
) -> Result<Json<Recording>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rec_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let coll = mongo.collection::<Recording>(COLL);
    coll.update_one(
        ownership_filter(user_id, oid),
        doc! { "$set": {
            "status": "failed",
            "errorMessage": input.error_message,
            "endedAt": now,
            "updatedAt": now,
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.fail")))?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("recording".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %rec_id))]
pub async fn delete_recording(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(rec_id): Path<String>,
) -> Result<Json<DeleteRecordingResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&rec_id)?;
    let coll = mongo.collection::<Recording>(COLL);
    let res = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabmeet_recordings.delete"))
        })?;
    Ok(Json(DeleteRecordingResponse {
        deleted: res.deleted_count > 0,
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn status_variants_set() {
        for s in ["recording", "processing", "ready", "failed"] {
            assert!(STATUS_VARIANTS.contains(&s));
        }
    }
}
