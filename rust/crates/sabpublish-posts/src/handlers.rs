//! HTTP handlers for SabPublish posts.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::{TimeZone, Utc};
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreatePostInput, CreatePostResponse, DeletePostResponse, ListQuery, UpdatePostInput,
};
use crate::types::SabpublishPost;

const COLL: &str = "sabpublish_posts";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn ms_to_bson(ms: i64) -> Option<BsonDateTime> {
    Utc.timestamp_millis_opt(ms)
        .single()
        .map(BsonDateTime::from_chrono)
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabpublishPost>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_posts(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let mut filter = doc! { "userId": user_id };
    if let Some(loc) = q.location_id.as_deref() {
        filter.insert("locationId", oid_from_str(loc)?);
    }
    if let Some(s) = q.status.as_deref() {
        filter.insert("status", s);
    }
    let limit = q.limit.unwrap_or(50).clamp(1, 500) as i64;
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": -1 })
        .limit(limit)
        .build();
    let coll = mongo.collection::<SabpublishPost>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("posts.find")))?;
    let items = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("posts.collect")))?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, post_id = %id))]
pub async fn get_post(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<SabpublishPost>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabpublishPost>(COLL);
    coll.find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("posts.find_one")))?
        .ok_or_else(|| ApiError::NotFound("post".to_owned()))
        .map(Json)
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_post(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreatePostInput>,
) -> Result<Json<CreatePostResponse>> {
    let user_id = user_oid(&user)?;
    let loc = oid_from_str(&input.location_id)?;
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let now = BsonDateTime::from_chrono(Utc::now());
    let schedule_at = input.schedule_at_ms.and_then(ms_to_bson);
    let status = input.status.unwrap_or_else(|| {
        if schedule_at.is_some() {
            "scheduled".to_owned()
        } else {
            "draft".to_owned()
        }
    });
    let mut entity = SabpublishPost {
        id: None,
        user_id,
        location_id: loc,
        provider_ids: input.provider_ids,
        body: input.body,
        media_file_ids: input.media_file_ids,
        schedule_at,
        status,
        published_at: None,
        error_message: None,
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabpublishPost>(COLL);
    let inserted = coll
        .insert_one(&entity)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("posts.insert")))?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreatePostResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, post_id = %id))]
pub async fn update_post(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdatePostInput>,
) -> Result<Json<SabpublishPost>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now };
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.provider_ids {
        set.insert("providerIds", v);
    }
    if let Some(v) = patch.media_file_ids {
        set.insert("mediaFileIds", v);
    }
    if let Some(ms) = patch.schedule_at_ms {
        if let Some(dt) = ms_to_bson(ms) {
            set.insert("scheduleAt", dt);
        }
    }
    if let Some(v) = patch.status {
        set.insert("status", v);
    }
    if let Some(v) = patch.error_message {
        set.insert("errorMessage", v);
    }
    if patch.mark_published.unwrap_or(false) {
        set.insert("status", "published");
        set.insert("publishedAt", now);
    }
    let coll = mongo.collection::<SabpublishPost>(COLL);
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("posts.update")))?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("post".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("posts.refetch")))?
        .ok_or_else(|| ApiError::NotFound("post".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, post_id = %id))]
pub async fn delete_post(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeletePostResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabpublishPost>(COLL);
    let result = coll
        .delete_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("posts.delete")))?;
    if result.deleted_count == 0 {
        return Err(ApiError::NotFound("post".to_owned()));
    }
    Ok(Json(DeletePostResponse { deleted: true }))
}
