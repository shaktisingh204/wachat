//! HTTP handlers for `/v1/sabshow/comments/*`.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{DateTime as BsonDateTime, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::mongo::MongoHandle;
use tracing::instrument;

use crate::dto::{
    CommentEnvelope, CommentListResponse, CreateCommentInput, ListCommentsQuery, UpdateCommentInput,
};
use crate::types::SabshowComment;

const COMMENTS_COLL: &str = "sabshow_comments";
const DECKS_COLL: &str = "sabshow_decks";

fn user_oid(a: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&a.user_id).map_err(|_| ApiError::Unauthorized("bad user".into()))
}
fn oid(s: &str, label: &str) -> Result<ObjectId> {
    ObjectId::parse_str(s).map_err(|_| ApiError::BadRequest(format!("invalid {label}")))
}

async fn assert_deck_visible(
    mongo: &MongoHandle,
    deck_oid: ObjectId,
    me: ObjectId,
) -> Result<()> {
    let visible = mongo
        .db()
        .collection::<Document>(DECKS_COLL)
        .find_one(doc! {
            "_id": deck_oid,
            "$or": [{ "ownerUserId": me }, { "sharedWithUserIds": me }],
        })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    if visible.is_none() {
        return Err(ApiError::Forbidden("deck not accessible".into()));
    }
    Ok(())
}

#[instrument(skip(mongo, auth))]
pub async fn list_comments(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Query(q): Query<ListCommentsQuery>,
) -> Result<Json<CommentListResponse>> {
    let me = user_oid(&auth)?;
    let deck_id = oid(&q.deck_id, "deckId")?;
    assert_deck_visible(&mongo, deck_id, me).await?;

    let mut filter = doc! { "deckId": deck_id };
    if let Some(s) = q.slide_id.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("slideId", oid(s, "slideId")?);
    }
    if !q.include_resolved.unwrap_or(false) {
        filter.insert("resolved", doc! { "$ne": true });
    }
    let coll = mongo.db().collection::<SabshowComment>(COMMENTS_COLL);
    let opts = FindOptions::builder()
        .sort(doc! { "createdAt": 1 })
        .build();
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let items: Vec<SabshowComment> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(CommentListResponse { items }))
}

#[instrument(skip(mongo, auth))]
pub async fn create_comment(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Json(input): Json<CreateCommentInput>,
) -> Result<Json<CommentEnvelope>> {
    let me = user_oid(&auth)?;
    if input.body.trim().is_empty() {
        return Err(ApiError::BadRequest("body is required".into()));
    }
    let deck_id = oid(&input.deck_id, "deckId")?;
    let slide_id = oid(&input.slide_id, "slideId")?;
    assert_deck_visible(&mongo, deck_id, me).await?;
    let element_id = input
        .element_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| oid(s, "elementId"))
        .transpose()?;
    let parent_id = input
        .parent_comment_id
        .as_deref()
        .filter(|s| !s.is_empty())
        .map(|s| oid(s, "parentCommentId"))
        .transpose()?;

    let comment = SabshowComment {
        id: None,
        deck_id,
        slide_id,
        element_id,
        author_user_id: me,
        body: input.body,
        resolved: false,
        parent_comment_id: parent_id,
        created_at: BsonDateTime::from_chrono(Utc::now()),
        updated_at: None,
    };
    let coll = mongo.db().collection::<SabshowComment>(COMMENTS_COLL);
    let res = coll
        .insert_one(&comment)
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let mut out = comment;
    out.id = res.inserted_id.as_object_id();
    Ok(Json(CommentEnvelope { comment: out }))
}

#[instrument(skip(mongo, auth))]
pub async fn update_comment(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(comment_id): Path<String>,
    Json(patch): Json<UpdateCommentInput>,
) -> Result<Json<CommentEnvelope>> {
    let me = user_oid(&auth)?;
    let cid = oid(&comment_id, "commentId")?;
    let coll = mongo.db().collection::<SabshowComment>(COMMENTS_COLL);
    let existing = coll
        .find_one(doc! { "_id": cid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("comment not found".into()))?;
    assert_deck_visible(&mongo, existing.deck_id, me).await?;
    // Body edits restricted to the author; resolve is open to any deck-visible user.
    let mut set = doc! { "updatedAt": BsonDateTime::from_chrono(Utc::now()) };
    if let Some(v) = patch.body {
        if existing.author_user_id != me {
            return Err(ApiError::Forbidden("not the author".into()));
        }
        set.insert("body", v);
    }
    if let Some(v) = patch.resolved {
        set.insert("resolved", v);
    }
    coll.update_one(doc! { "_id": cid }, doc! { "$set": set })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    let comment = coll
        .find_one(doc! { "_id": cid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("comment not found".into()))?;
    Ok(Json(CommentEnvelope { comment }))
}

#[instrument(skip(mongo, auth))]
pub async fn delete_comment(
    State(mongo): State<MongoHandle>,
    auth: AuthUser,
    Path(comment_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let me = user_oid(&auth)?;
    let cid = oid(&comment_id, "commentId")?;
    let coll = mongo.db().collection::<SabshowComment>(COMMENTS_COLL);
    let existing = coll
        .find_one(doc! { "_id": cid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?
        .ok_or_else(|| ApiError::NotFound("comment not found".into()))?;
    if existing.author_user_id != me {
        return Err(ApiError::Forbidden("not the author".into()));
    }
    coll.delete_one(doc! { "_id": cid })
        .await
        .map_err(|e| ApiError::Internal(e.into()))?;
    Ok(Json(serde_json::json!({ "deleted": true })))
}
