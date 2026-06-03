//! HTTP handlers for SabSheet comments.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::tenant::user_oid;
use futures::TryStreamExt;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    CreateCommentInput, CreateCommentResponse, DeleteResponse, ListQuery, ListResponse,
    UpdateCommentInput,
};
use crate::types::SabsheetComment;

pub(crate) const COLL: &str = "sabsheet_comments";

fn from_create(input: CreateCommentInput, user_id: ObjectId) -> Result<SabsheetComment> {
    let body = input.body.trim();
    if body.is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    Ok(SabsheetComment {
        id: None,
        sheet_id: oid_from_str(&input.sheet_id)?,
        workbook_id: oid_from_str(&input.workbook_id)?,
        owner_user_id: user_id,
        row: input.row,
        col: input.col,
        author_user_id: user_id,
        body: body.to_owned(),
        resolved: false,
        parent_comment_id: input
            .parent_comment_id
            .and_then(|s| ObjectId::parse_str(&s).ok()),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update(patch: UpdateCommentInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch
        .body
        .map(|s| s.trim().to_owned())
        .filter(|s| !s.is_empty())
    {
        set.insert("body", v);
    }
    if let Some(v) = patch.resolved {
        set.insert("resolved", v);
    }
    doc! { "$set": set }
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_comments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let wb = oid_from_str(&q.workbook_id)?;
    let mut filter = doc! { "workbookId": wb, "ownerUserId": user_id };
    if let Some(sid) = q.sheet_id.and_then(|s| ObjectId::parse_str(&s).ok()) {
        filter.insert("sheetId", sid);
    }
    if !q.include_resolved.unwrap_or(false) {
        filter.insert("resolved", doc! { "$ne": true });
    }
    let coll = mongo.collection::<SabsheetComment>(COLL);
    let cursor = coll
        .find(filter)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabsheet_comments.find")))?;
    let items: Vec<SabsheetComment> = cursor.try_collect().await.unwrap_or_default();
    Ok(Json(ListResponse { items }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<CreateCommentResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = from_create(input, user_id)?;
    let coll = mongo.collection::<SabsheetComment>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabsheet_comments.insert"))
    })?;
    let id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id not ObjectId")))?;
    entity.id = Some(id);
    Ok(Json(CreateCommentResponse {
        id: id.to_hex(),
        entity,
    }))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn update_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
    Json(patch): Json<UpdateCommentInput>,
) -> Result<Json<SabsheetComment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabsheetComment>(COLL);
    let filter = doc! { "_id": oid, "ownerUserId": user_id };
    coll.update_one(filter.clone(), build_update(patch))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_comments.update"))
        })?;
    let after = coll
        .find_one(filter)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_comments.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn delete_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(id): Path<String>,
) -> Result<Json<DeleteResponse>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&id)?;
    let coll = mongo.collection::<SabsheetComment>(COLL);
    let r = coll
        .delete_one(doc! { "_id": oid, "ownerUserId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabsheet_comments.delete"))
        })?;
    if r.deleted_count == 0 {
        return Err(ApiError::NotFound("comment".to_owned()));
    }
    Ok(Json(DeleteResponse { deleted: true }))
}
