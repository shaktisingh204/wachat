//! HTTP handlers for SabConnect comments.

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
    CreateCommentInput, CreateCommentResponse, DeleteCommentResponse, ListCommentsResponse,
    ListQuery, UpdateCommentInput,
};
use crate::types::SabConnectComment;

const COLL: &str = "sabconnect_comments";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_comments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListCommentsResponse>> {
    let user_id = user_oid(&user)?;
    let item_id = ObjectId::parse_str(&q.item_id)
        .map_err(|_| ApiError::Validation("itemId must be ObjectId".to_owned()))?;
    let mut filter = doc! {
        "userId": user_id,
        "itemId": item_id,
        "status": doc! { "$ne": "deleted" },
    };
    if let Some(p) = q.parent_comment_id.as_deref() {
        if p == "root" {
            filter.insert("parentCommentId", doc! { "$exists": false });
        } else if let Ok(oid) = ObjectId::parse_str(p) {
            filter.insert("parentCommentId", oid);
        }
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<SabConnectComment>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_comments.find"))
    })?;
    let mut rows: Vec<SabConnectComment> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_comments.collect"))
    })?;
    let has_more = rows.len() as i64 > limit;
    if has_more {
        rows.truncate(limit as usize);
    }
    Ok(Json(ListCommentsResponse {
        items: rows,
        page: q.page.unwrap_or(0),
        limit: limit as u32,
        has_more,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<CreateCommentResponse>> {
    let user_id = user_oid(&user)?;
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let item_id = ObjectId::parse_str(&input.item_id)
        .map_err(|_| ApiError::Validation("itemId must be ObjectId".to_owned()))?;
    let author_id = ObjectId::parse_str(&input.author_id)
        .map_err(|_| ApiError::Validation("authorId must be ObjectId".to_owned()))?;
    let parent_comment_id = input
        .parent_comment_id
        .as_deref()
        .and_then(|s| ObjectId::parse_str(s).ok());
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabConnectComment {
        id: None,
        user_id,
        item_id,
        parent_comment_id,
        author_id,
        author_name: input.author_name,
        author_avatar_url: input.author_avatar_url,
        body: input.body.trim().to_owned(),
        attachment_ids: input.attachment_ids.unwrap_or_default(),
        edited: false,
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabConnectComment>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabconnect_comments.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    Ok(Json(CreateCommentResponse {
        id: new_id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %comment_id))]
pub async fn update_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(comment_id): Path<String>,
    Json(patch): Json<UpdateCommentInput>,
) -> Result<Json<SabConnectComment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&comment_id)?;
    let coll = mongo.collection::<SabConnectComment>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut set = doc! { "updatedAt": now, "edited": true };
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.attachment_ids {
        set.insert("attachmentIds", v);
    }
    let update = doc! { "$set": set };
    let result = coll
        .update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_comments.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("comment".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_comments.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %comment_id))]
pub async fn delete_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(comment_id): Path<String>,
) -> Result<Json<DeleteCommentResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&comment_id)?;
    let coll = mongo.collection::<SabConnectComment>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "deleted",
                "body": "",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabconnect_comments.delete"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("comment".to_owned()));
    }
    Ok(Json(DeleteCommentResponse { deleted: true }))
}
