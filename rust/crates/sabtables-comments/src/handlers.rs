//! HTTP handlers for the Comment entity.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateCommentInput, CreateCommentResponse, DeleteCommentResponse, ListQuery,
    UpdateCommentInput,
};
use crate::types::SabtablesComment;

const COLL: &str = "sabtables_comments";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<SabtablesComment>,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_comments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let record_oid = oid_from_str(&q.record_id)?;
    let filter = doc! {
        "userId": user_id,
        "recordId": record_oid,
        "status": { "$ne": "archived" },
    };
    let opts = FindOptions::builder().sort(doc! { "createdAt": 1 }).build();
    let coll = mongo.collection::<SabtablesComment>(COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_comments.find"))
        })?;
    let items: Vec<SabtablesComment> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_comments.collect"))
    })?;
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %comment_id))]
pub async fn get_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(comment_id): Path<String>,
) -> Result<Json<SabtablesComment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&comment_id)?;
    let coll = mongo.collection::<SabtablesComment>(COLL);
    let row = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_comments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;
    Ok(Json(row))
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
    let record_oid = oid_from_str(&input.record_id)?;
    let table_oid = oid_from_str(&input.table_id)?;
    let parent_oid = match input.parent_comment_id.as_deref().filter(|s| !s.is_empty()) {
        Some(s) => Some(oid_from_str(s)?),
        None => None,
    };
    let now = BsonDateTime::from_chrono(Utc::now());
    let mut entity = SabtablesComment {
        id: None,
        user_id,
        record_id: record_oid,
        table_id: table_oid,
        parent_comment_id: parent_oid,
        author_id: user_id,
        body: input.body,
        status: "active".to_owned(),
        created_at: now,
        updated_at: None,
    };
    let coll = mongo.collection::<SabtablesComment>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabtables_comments.insert"))
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
) -> Result<Json<SabtablesComment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&comment_id)?;
    let coll = mongo.collection::<SabtablesComment>(COLL);
    let now = BsonDateTime::from_chrono(Utc::now());
    let set = doc! { "body": patch.body, "updatedAt": now };
    let result = coll
        .update_one(ownership_filter(user_id, oid), doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_comments.update"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("comment".to_owned()));
    }
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_comments.refetch"))
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
    let coll = mongo.collection::<SabtablesComment>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "archived",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabtables_comments.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("comment".to_owned()));
    }
    Ok(Json(DeleteCommentResponse { deleted: true }))
}
