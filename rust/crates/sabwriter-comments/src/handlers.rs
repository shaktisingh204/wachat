//! HTTP handlers for sabwriter-comments.

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
    CreateCommentInput, CreateCommentResponse, DeleteCommentResponse, ListQuery, ListResponse,
    UpdateCommentInput,
};
use crate::types::SabwriterComment;

const COLL: &str = "sabwriter_comments";
const DOCS_COLL: &str = "sabwriter_documents";

fn now_bson() -> BsonDateTime {
    BsonDateTime::from_chrono(Utc::now())
}

async fn assert_doc_access(
    mongo: &MongoHandle,
    user_id: ObjectId,
    document_id: ObjectId,
) -> Result<()> {
    let coll = mongo.collection::<Document>(DOCS_COLL);
    let _ = coll
        .find_one(doc! {
            "_id": document_id,
            "$or": [
                { "userId": user_id },
                { "sharedWithUserIds": user_id },
            ]
        })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_documents.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_document".to_owned()))?;
    Ok(())
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_comments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&q.document_id)?;
    assert_doc_access(&mongo, user_id, doc_oid).await?;

    let mut filter = doc! { "documentId": doc_oid };
    match q.status.as_deref().unwrap_or("all") {
        "open" => {
            filter.insert("resolved", false);
        }
        "resolved" => {
            filter.insert("resolved", true);
        }
        _ => {}
    }

    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();

    let coll = mongo.collection::<SabwriterComment>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.find"))
    })?;
    let mut rows: Vec<SabwriterComment> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.collect"))
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

#[instrument(skip_all, fields(user_id = %user.user_id, id = %comment_id))]
pub async fn get_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(comment_id): Path<String>,
) -> Result<Json<SabwriterComment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&comment_id)?;
    let coll = mongo.collection::<SabwriterComment>(COLL);
    let row = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_comment".to_owned()))?;
    assert_doc_access(&mongo, user_id, row.document_id).await?;
    Ok(Json(row))
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn create_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<CreateCommentResponse>> {
    let user_id = user_oid(&user)?;
    let doc_oid = oid_from_str(&input.document_id)?;
    assert_doc_access(&mongo, user_id, doc_oid).await?;

    let body = input.body.trim().to_owned();
    if body.is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let parent_comment_id = match input
        .parent_comment_id
        .as_deref()
        .map(str::trim)
        .filter(|s| !s.is_empty())
    {
        Some(s) => Some(
            ObjectId::parse_str(s)
                .map_err(|_| ApiError::Validation("invalid parentCommentId".to_owned()))?,
        ),
        None => None,
    };

    let mut entity = SabwriterComment {
        id: None,
        user_id,
        document_id: doc_oid,
        anchor: input.anchor,
        author_user_id: user_id,
        body,
        resolved: false,
        parent_comment_id,
        created_at: now_bson(),
        updated_at: None,
        resolved_at: None,
        resolved_by: None,
    };

    let coll = mongo.collection::<SabwriterComment>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.insert"))
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
) -> Result<Json<SabwriterComment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&comment_id)?;
    let coll = mongo.collection::<SabwriterComment>(COLL);
    let before = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_comment".to_owned()))?;
    assert_doc_access(&mongo, user_id, before.document_id).await?;
    // Body edits restricted to the author.
    if let Some(ref _b) = patch.body {
        if before.author_user_id != user_id {
            return Err(ApiError::Validation(
                "only the author can edit a comment body".to_owned(),
            ));
        }
    }
    let mut set = doc! { "updatedAt": now_bson() };
    if let Some(b) = patch.body {
        set.insert("body", b);
    }
    if let Some(r) = patch.resolved {
        set.insert("resolved", r);
        if r {
            set.insert("resolvedAt", now_bson());
            set.insert("resolvedBy", user_id);
        }
    }
    coll.update_one(doc! { "_id": oid }, doc! { "$set": set })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.update"))
        })?;
    let after = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_comment".to_owned()))?;
    Ok(Json(after))
}

#[instrument(skip_all, fields(user_id = %user.user_id, id = %comment_id))]
pub async fn resolve_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Path(comment_id): Path<String>,
) -> Result<Json<SabwriterComment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&comment_id)?;
    let coll = mongo.collection::<SabwriterComment>(COLL);
    let before = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_comment".to_owned()))?;
    assert_doc_access(&mongo, user_id, before.document_id).await?;
    coll.update_one(
        doc! { "_id": oid },
        doc! { "$set": {
            "resolved": true,
            "resolvedAt": now_bson(),
            "resolvedBy": user_id,
            "updatedAt": now_bson(),
        }},
    )
    .await
    .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.resolve")))?;
    let after = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_comment".to_owned()))?;
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
    let coll = mongo.collection::<SabwriterComment>(COLL);
    let before = coll
        .find_one(doc! { "_id": oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("sabwriter_comment".to_owned()))?;
    if before.author_user_id != user_id {
        return Err(ApiError::Validation(
            "only the author can delete a comment".to_owned(),
        ));
    }
    let res = coll
        .delete_one(doc! { "_id": oid, "authorUserId": user_id })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabwriter_comments.delete"))
        })?;
    Ok(Json(DeleteCommentResponse {
        deleted: res.deleted_count > 0,
    }))
}
