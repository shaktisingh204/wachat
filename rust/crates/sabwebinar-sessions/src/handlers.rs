//! HTTP handlers for the SabWebinar Session entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{DateTime, Utc};
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
    CreateSessionInput, CreateSessionResponse, ListQuery, ListResponse, UpdateSessionInput,
};
use crate::types::Session;

const COLL: &str = "sabwebinar_sessions";

fn parse_date(s: &str) -> Option<BsonDateTime> {
    DateTime::parse_from_rfc3339(s)
        .ok()
        .map(|d| BsonDateTime::from_chrono(d.with_timezone(&Utc)))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_sessions(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter: Document = doc! { "userId": user_id };
    if let Some(w) = q
        .webinar_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok())
    {
        filter.insert("webinarId", w);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "startedAt": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<Session>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_sessions.find"))
        })?;
    let mut rows: Vec<Session> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_sessions.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn get_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
) -> Result<Json<Session>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<Session>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_sessions.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("session".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateSessionInput>,
) -> Result<Json<CreateSessionResponse>> {
    let user_id = user_oid(&user)?;
    let webinar_oid = oid_from_str(&input.webinar_id)?;
    let mut entity = Session {
        id: None,
        user_id,
        webinar_id: webinar_oid,
        started_at: BsonDateTime::from_chrono(Utc::now()),
        ended_at: None,
        peak_concurrent: 0,
        stream_url: input.stream_url,
        sfu_room_id: input.sfu_room_id,
    };
    let coll = mongo.collection::<Session>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_sessions.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateSessionResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %session_id))]
pub async fn update_session(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(session_id): Path<String>,
    Json(patch): Json<UpdateSessionInput>,
) -> Result<Json<Session>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&session_id)?;
    let coll = mongo.collection::<Session>(COLL);
    let mut set = doc! {};
    if let Some(v) = patch.ended_at.as_deref().and_then(parse_date) {
        set.insert("endedAt", v);
    }
    if let Some(v) = patch.peak_concurrent {
        set.insert("peakConcurrent", v as i64);
    }
    if let Some(v) = patch.stream_url {
        set.insert("streamUrl", v);
    }
    if let Some(v) = patch.sfu_room_id {
        set.insert("sfuRoomId", v);
    }
    let result = coll
        .update_one(
            doc! { "_id": oid, "userId": user_id },
            doc! { "$set": set },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_sessions.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("session".to_owned()));
    }
    let after = coll
        .find_one(doc! { "_id": oid, "userId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwebinar_sessions.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("session".to_owned()))?;
    Ok(Json(after))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn parse_date_round_trip() {
        let s = "2025-01-01T00:00:00Z";
        assert!(parse_date(s).is_some());
    }
}
