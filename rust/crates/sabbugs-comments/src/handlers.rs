//! HTTP handlers for BugComment.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use crm_common::{
    audit::{audit_for_create, audit_for_delete, audit_for_update, write_audit},
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
    CreateCommentInput, CreateCommentResponse, DeleteCommentResponse, ListQuery,
    UpdateCommentInput,
};
use crate::types::BugComment;

const COLL: &str = "sabbugs_comments";
const ENTITY_KIND: &str = "bug_comment";

fn ownership_filter(user_id: ObjectId, oid: ObjectId) -> Document {
    doc! { "_id": oid, "userId": user_id }
}

fn comment_from_create(input: CreateCommentInput, user_id: ObjectId) -> Result<BugComment> {
    if input.body.trim().is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let bug_id = ObjectId::parse_str(input.bug_id.trim())
        .map_err(|_| ApiError::Validation("invalid bugId".to_owned()))?;
    Ok(BugComment {
        id: None,
        user_id,
        bug_id,
        author_id: user_id,
        body: input.body,
        attachment_ids: input.attachment_ids.unwrap_or_default(),
        status: "active".to_owned(),
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    })
}

fn build_update_doc(patch: UpdateCommentInput) -> Document {
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.body {
        set.insert("body", v);
    }
    if let Some(v) = patch.attachment_ids {
        set.insert("attachmentIds", v);
    }
    doc! { "$set": set }
}

fn doc_for_audit(entity: &BugComment) -> Document {
    bson::to_document(entity).unwrap_or_default()
}

#[derive(Debug, Clone, serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListResponse {
    pub items: Vec<BugComment>,
    pub page: u32,
    pub limit: u32,
    pub has_more: bool,
}

#[instrument(skip_all, fields(user_id = %user.user_id))]
pub async fn list_comments(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Query(q): Query<ListQuery>,
) -> Result<Json<ListResponse>> {
    let user_id = user_oid(&user)?;
    let bug_id = ObjectId::parse_str(q.bug_id.trim())
        .map_err(|_| ApiError::Validation("invalid bugId".to_owned()))?;
    let mut filter = doc! { "userId": user_id, "bugId": bug_id };
    if !q.include_deleted.unwrap_or(false) {
        filter.insert("status", doc! { "$ne": "deleted" });
    }
    let limit = clamp_limit(q.limit);
    let skip = skip_for(q.page, limit);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .skip(skip)
        .limit(limit + 1)
        .build();
    let coll = mongo.collection::<BugComment>(COLL);
    let cursor = coll.find(filter).with_options(opts).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_comments.find"))
    })?;
    let mut rows: Vec<BugComment> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_comments.collect"))
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
pub async fn create_comment(
    user: AuthUser,
    State(mongo): State<MongoHandle>,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<CreateCommentResponse>> {
    let user_id = user_oid(&user)?;
    let mut entity = comment_from_create(input, user_id)?;
    let coll = mongo.collection::<BugComment>(COLL);
    let inserted = coll.insert_one(&entity).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabbugs_comments.insert"))
    })?;
    let new_id = inserted
        .inserted_id
        .as_object_id()
        .ok_or_else(|| ApiError::Internal(anyhow::anyhow!("inserted_id was not ObjectId")))?;
    entity.id = Some(new_id);
    if let Some(event) =
        audit_for_create(&user, ENTITY_KIND, new_id, Some(doc_for_audit(&entity)))
    {
        write_audit(&mongo, event).await;
    }
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
) -> Result<Json<BugComment>> {
    let user_id = user_oid(&user)?;
    let oid = oid_from_str(&comment_id)?;
    let coll = mongo.collection::<BugComment>(COLL);
    let before = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_comments.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;
    let update = build_update_doc(patch);
    coll.update_one(ownership_filter(user_id, oid), update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_comments.update"))
        })?;
    let after = coll
        .find_one(ownership_filter(user_id, oid))
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_comments.refetch"))
        })?
        .ok_or_else(|| ApiError::NotFound("comment".to_owned()))?;
    if let Some(event) = audit_for_update(
        &user,
        ENTITY_KIND,
        oid,
        Some(doc_for_audit(&before)),
        Some(doc_for_audit(&after)),
    ) {
        write_audit(&mongo, event).await;
    }
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
    let coll = mongo.collection::<BugComment>(COLL);
    let result = coll
        .update_one(
            ownership_filter(user_id, oid),
            doc! { "$set": {
                "status": "deleted",
                "updatedAt": BsonDateTime::from_chrono(Utc::now()),
            }},
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabbugs_comments.archive"))
        })?;
    if result.matched_count == 0 {
        return Err(ApiError::NotFound("comment".to_owned()));
    }
    if let Some(event) = audit_for_delete(&user, ENTITY_KIND, oid) {
        write_audit(&mongo, event).await;
    }
    Ok(Json(DeleteCommentResponse { deleted: true }))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn comment_from_create_requires_body() {
        let user_id = ObjectId::new();
        let bug_id = ObjectId::new();
        assert!(
            comment_from_create(
                CreateCommentInput {
                    bug_id: bug_id.to_hex(),
                    body: "  ".into(),
                    ..Default::default()
                },
                user_id,
            )
            .is_err()
        );
    }

    #[test]
    fn comment_from_create_sets_author_to_caller() {
        let user_id = ObjectId::new();
        let bug_id = ObjectId::new();
        let c = comment_from_create(
            CreateCommentInput {
                bug_id: bug_id.to_hex(),
                body: "looks bad".into(),
                ..Default::default()
            },
            user_id,
        )
        .unwrap();
        assert_eq!(c.author_id, user_id);
        assert_eq!(c.status, "active");
    }
}
