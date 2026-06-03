//! HTTP handlers for SabLens frame snapshots.

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

use crate::dto::{CreateFrameInput, CreateFrameResponse, DeleteFrameResponse, ListQuery};
use crate::types::SablensFrame;

const COLL: &str = "sablens_frames";

fn ownership(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SablensFrame>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_frames(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(s) = q.session_id.as_deref().filter(|s| !s.is_empty()) {
        let oid = oid_from_str(s)?;
        filter.insert("sessionId", oid);
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "ts": -1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SablensFrame>(COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sablens_frames.find"))
        })?;
    let mut rows: Vec<SablensFrame> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_frames.collect")))?;
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn get_frame(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SablensFrame>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SablensFrame>(COLL);
    let row = coll
        .find_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_frames.find_one")))?
        .ok_or_else(|| ApiError::NotFound("sablens_frame".to_owned()))?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_frame(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateFrameInput>,
) -> Result<Json<CreateFrameResponse>> {
    let user_id = user_oid(&user)?;
    if input.file_id.trim().is_empty() {
        return Err(ApiError::Validation("fileId is required".to_owned()));
    }
    let session_oid = oid_from_str(&input.session_id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SablensFrame {
        id: None,
        user_id,
        session_id: session_oid,
        ts: now,
        file_id: input.file_id,
        device_orientation: input.device_orientation,
        sensor_info_json: input.sensor_info_json,
        created_at: now,
    };
    let coll = mongo.collection::<SablensFrame>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_frames.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateFrameResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %id))]
pub async fn delete_frame(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteFrameResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SablensFrame>(COLL);
    let res = coll
        .delete_one(ownership(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sablens_frames.delete")))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("sablens_frame".to_owned()));
    }
    Ok(Json(DeleteFrameResponse { deleted: true }))
}
