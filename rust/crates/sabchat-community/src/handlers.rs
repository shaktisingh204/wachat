//! HTTP handlers for the SabChat **community forum** domain.
//!
//! Tenant-scoped CRUD over two collections:
//!
//! | Collection                  | Direction | Notes                          |
//! |-----------------------------|-----------|--------------------------------|
//! | `sabchat_community_topics`  | r/w       | one row per question/thread    |
//! | `sabchat_community_posts`   | r/w       | replies, FK `topic_id`         |
//!
//! ## Tenancy
//!
//! Every read and write filters on `tenant_id = ObjectId(auth.tenant_id)`.
//! A malformed JWT subject yields [`ApiError::Unauthorized`] — no
//! cross-tenant access is possible from the wire.
//!
//! ## Voting
//!
//! Upvotes are stored as a `voters: [ObjectId]` set (the caller's
//! `user_id`); the integer `upvotes` count is kept in sync so list views
//! can sort without `$size`. A vote endpoint toggles membership.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json};
use tracing::instrument;

use crate::dto::{
    CreatePostBody, CreateTopicBody, IdResponse, ListTopicsQuery, ListTopicsResponse,
    SuccessResponse, TopicDetailResponse, UpdateTopicBody, UpvoteResponse, VALID_TOPIC_STATUSES,
};
use crate::state::SabChatCommunityState;

const TOPICS_COLL: &str = "sabchat_community_topics";
const POSTS_COLL: &str = "sabchat_community_posts";

// ===========================================================================
// Helpers
// ===========================================================================

fn tenant_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant claim is not a valid ObjectId".to_owned()))
}

fn author_oid(user: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&user.user_id)
        .map_err(|_| ApiError::Unauthorized("user claim is not a valid ObjectId".to_owned()))
}

fn now_bson() -> bson::DateTime {
    bson::DateTime::from_chrono(Utc::now())
}

fn internal(ctx: &'static str) -> impl Fn(mongodb::error::Error) -> ApiError {
    move |e| ApiError::Internal(anyhow::Error::new(e).context(ctx))
}

// ===========================================================================
// POST /topics — create_topic
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_topic(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Json(body): Json<CreateTopicBody>,
) -> Result<Json<IdResponse>> {
    let title = body.title.trim();
    let post_body = body.body.trim();
    if title.is_empty() {
        return Err(ApiError::Validation("title is required".to_owned()));
    }
    if post_body.is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }

    let tenant_id = tenant_oid(&user)?;
    let author_id = author_oid(&user)?;
    let now = now_bson();
    let new_oid = ObjectId::new();

    let doc = doc! {
        "_id": new_oid,
        "tenant_id": tenant_id,
        "title": title,
        "body": post_body,
        "category": body.category.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        "author_id": author_id,
        "author_name": body.author_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        "status": "open",
        "pinned": false,
        "voters": Vec::<ObjectId>::new(),
        "upvotes": 0_i64,
        "reply_count": 0_i64,
        "answer_post_id": bson::Bson::Null,
        "last_activity_at": now,
        "created_at": now,
        "updated_at": now,
    };

    state
        .mongo
        .collection::<Document>(TOPICS_COLL)
        .insert_one(doc)
        .await
        .map_err(internal("sabchat_community_topics.insert_one"))?;

    Ok(Json(IdResponse {
        id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// GET /topics — list_topics
// ===========================================================================

#[instrument(skip_all)]
pub async fn list_topics(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Query(q): Query<ListTopicsQuery>,
) -> Result<Json<ListTopicsResponse>> {
    let tenant_id = tenant_oid(&user)?;

    let mut filter = doc! { "tenant_id": tenant_id };
    if let Some(cat) = q.category.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("category", cat);
    }
    if let Some(status) = q.status.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        filter.insert("status", status);
    }

    // `top` → most upvoted; default → pinned first, then last activity.
    let sort = if q.sort.as_deref() == Some("top") {
        doc! { "pinned": -1, "upvotes": -1, "last_activity_at": -1 }
    } else {
        doc! { "pinned": -1, "last_activity_at": -1 }
    };
    let limit = q.limit.unwrap_or(100).clamp(1, 200);

    let opts = FindOptions::builder().sort(sort).limit(limit).build();

    let cursor = state
        .mongo
        .collection::<Document>(TOPICS_COLL)
        .find(filter)
        .with_options(opts)
        .await
        .map_err(internal("sabchat_community_topics.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_community_topics.collect"))?;

    let topics = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListTopicsResponse { topics }))
}

// ===========================================================================
// GET /topics/{id} — get_topic (topic + its posts)
// ===========================================================================

#[instrument(skip_all, fields(topic_id = %topic_id))]
pub async fn get_topic(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Path(topic_id): Path<String>,
) -> Result<Json<TopicDetailResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let topic_oid =
        oid_from_str(&topic_id).map_err(|_| ApiError::BadRequest("invalid topic id".to_owned()))?;

    let topic = state
        .mongo
        .collection::<Document>(TOPICS_COLL)
        .find_one(doc! { "_id": topic_oid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_community_topics.find_one"))?
        .ok_or_else(|| ApiError::NotFound("topic not found".to_owned()))?;

    let opts = FindOptions::builder()
        .sort(doc! { "is_answer": -1, "upvotes": -1, "created_at": 1 })
        .build();
    let cursor = state
        .mongo
        .collection::<Document>(POSTS_COLL)
        .find(doc! { "tenant_id": tenant_id, "topic_id": topic_oid })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_community_posts.find"))?;
    let post_docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_community_posts.collect"))?;

    Ok(Json(TopicDetailResponse {
        topic: document_to_clean_json(topic),
        posts: post_docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

// ===========================================================================
// PATCH /topics/{id} — update_topic (partial; moderation + author edits)
// ===========================================================================

#[instrument(skip_all, fields(topic_id = %topic_id))]
pub async fn update_topic(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Path(topic_id): Path<String>,
    Json(body): Json<UpdateTopicBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let topic_oid =
        oid_from_str(&topic_id).map_err(|_| ApiError::BadRequest("invalid topic id".to_owned()))?;

    let mut set = doc! { "updated_at": now_bson() };
    if let Some(title) = body.title.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        set.insert("title", title);
    }
    if let Some(b) = body.body.as_deref().map(str::trim).filter(|s| !s.is_empty()) {
        set.insert("body", b);
    }
    if let Some(cat) = body.category.as_ref() {
        set.insert("category", cat.trim());
    }
    if let Some(status) = body.status.as_deref().map(str::trim) {
        if !VALID_TOPIC_STATUSES.contains(&status) {
            return Err(ApiError::BadRequest(format!(
                "invalid status `{status}`; expected one of: {}",
                VALID_TOPIC_STATUSES.join(", "),
            )));
        }
        set.insert("status", status);
    }
    if let Some(pinned) = body.pinned {
        set.insert("pinned", pinned);
    }

    // `updated_at` is always present; require at least one real field.
    if set.len() <= 1 {
        return Err(ApiError::BadRequest("no updatable fields supplied".to_owned()));
    }

    let res = state
        .mongo
        .collection::<Document>(TOPICS_COLL)
        .update_one(
            doc! { "_id": topic_oid, "tenant_id": tenant_id },
            doc! { "$set": set },
        )
        .await
        .map_err(internal("sabchat_community_topics.update_one"))?;

    if res.matched_count == 0 {
        return Err(ApiError::NotFound("topic not found".to_owned()));
    }
    Ok(Json(SuccessResponse {
        message: "topic updated".to_owned(),
    }))
}

// ===========================================================================
// DELETE /topics/{id} — delete_topic (+ its posts)
// ===========================================================================

#[instrument(skip_all, fields(topic_id = %topic_id))]
pub async fn delete_topic(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Path(topic_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let topic_oid =
        oid_from_str(&topic_id).map_err(|_| ApiError::BadRequest("invalid topic id".to_owned()))?;

    let res = state
        .mongo
        .collection::<Document>(TOPICS_COLL)
        .delete_one(doc! { "_id": topic_oid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_community_topics.delete_one"))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("topic not found".to_owned()));
    }

    // Best-effort cascade — orphaned replies are useless.
    let _ = state
        .mongo
        .collection::<Document>(POSTS_COLL)
        .delete_many(doc! { "tenant_id": tenant_id, "topic_id": topic_oid })
        .await;

    Ok(Json(SuccessResponse {
        message: "topic deleted".to_owned(),
    }))
}

// ===========================================================================
// POST /topics/{id}/upvote — upvote_topic (toggle)
// ===========================================================================

#[instrument(skip_all, fields(topic_id = %topic_id))]
pub async fn upvote_topic(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Path(topic_id): Path<String>,
) -> Result<Json<UpvoteResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let voter = author_oid(&user)?;
    let topic_oid =
        oid_from_str(&topic_id).map_err(|_| ApiError::BadRequest("invalid topic id".to_owned()))?;
    toggle_vote(&state, TOPICS_COLL, tenant_id, topic_oid, voter).await
}

// ===========================================================================
// POST /topics/{id}/posts — create_post (reply)
// ===========================================================================

#[instrument(skip_all, fields(topic_id = %topic_id))]
pub async fn create_post(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Path(topic_id): Path<String>,
    Json(body): Json<CreatePostBody>,
) -> Result<Json<IdResponse>> {
    let post_body = body.body.trim();
    if post_body.is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let tenant_id = tenant_oid(&user)?;
    let author_id = author_oid(&user)?;
    let topic_oid =
        oid_from_str(&topic_id).map_err(|_| ApiError::BadRequest("invalid topic id".to_owned()))?;

    // The topic must exist in this tenant before we attach a reply.
    let topic_exists = state
        .mongo
        .collection::<Document>(TOPICS_COLL)
        .find_one(doc! { "_id": topic_oid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_community_topics.find_one"))?
        .is_some();
    if !topic_exists {
        return Err(ApiError::NotFound("topic not found".to_owned()));
    }

    let now = now_bson();
    let new_oid = ObjectId::new();
    let doc = doc! {
        "_id": new_oid,
        "tenant_id": tenant_id,
        "topic_id": topic_oid,
        "body": post_body,
        "author_id": author_id,
        "author_name": body.author_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
        "is_answer": false,
        "voters": Vec::<ObjectId>::new(),
        "upvotes": 0_i64,
        "created_at": now,
        "updated_at": now,
    };
    state
        .mongo
        .collection::<Document>(POSTS_COLL)
        .insert_one(doc)
        .await
        .map_err(internal("sabchat_community_posts.insert_one"))?;

    // Bump the topic's reply counter + activity clock.
    let _ = state
        .mongo
        .collection::<Document>(TOPICS_COLL)
        .update_one(
            doc! { "_id": topic_oid, "tenant_id": tenant_id },
            doc! { "$inc": { "reply_count": 1_i64 }, "$set": { "last_activity_at": now, "updated_at": now } },
        )
        .await;

    Ok(Json(IdResponse {
        id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// POST /posts/{id}/upvote — upvote_post (toggle)
// ===========================================================================

#[instrument(skip_all, fields(post_id = %post_id))]
pub async fn upvote_post(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Path(post_id): Path<String>,
) -> Result<Json<UpvoteResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let voter = author_oid(&user)?;
    let post_oid =
        oid_from_str(&post_id).map_err(|_| ApiError::BadRequest("invalid post id".to_owned()))?;
    toggle_vote(&state, POSTS_COLL, tenant_id, post_oid, voter).await
}

// ===========================================================================
// POST /posts/{id}/answer — mark_answer (accept a reply)
// ===========================================================================

#[instrument(skip_all, fields(post_id = %post_id))]
pub async fn mark_answer(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Path(post_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let post_oid =
        oid_from_str(&post_id).map_err(|_| ApiError::BadRequest("invalid post id".to_owned()))?;

    let post = state
        .mongo
        .collection::<Document>(POSTS_COLL)
        .find_one(doc! { "_id": post_oid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_community_posts.find_one"))?
        .ok_or_else(|| ApiError::NotFound("post not found".to_owned()))?;
    let topic_oid = post
        .get_object_id("topic_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("post missing topic_id")))?;

    let now = now_bson();
    // Clear any previous accepted answer on this topic, then set this one.
    let _ = state
        .mongo
        .collection::<Document>(POSTS_COLL)
        .update_many(
            doc! { "tenant_id": tenant_id, "topic_id": topic_oid },
            doc! { "$set": { "is_answer": false } },
        )
        .await;
    state
        .mongo
        .collection::<Document>(POSTS_COLL)
        .update_one(
            doc! { "_id": post_oid, "tenant_id": tenant_id },
            doc! { "$set": { "is_answer": true, "updated_at": now } },
        )
        .await
        .map_err(internal("sabchat_community_posts.update_one"))?;
    let _ = state
        .mongo
        .collection::<Document>(TOPICS_COLL)
        .update_one(
            doc! { "_id": topic_oid, "tenant_id": tenant_id },
            doc! { "$set": { "status": "answered", "answer_post_id": post_oid, "updated_at": now } },
        )
        .await;

    Ok(Json(SuccessResponse {
        message: "answer accepted".to_owned(),
    }))
}

// ===========================================================================
// DELETE /posts/{id} — delete_post (moderation)
// ===========================================================================

#[instrument(skip_all, fields(post_id = %post_id))]
pub async fn delete_post(
    user: AuthUser,
    State(state): State<SabChatCommunityState>,
    Path(post_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let post_oid =
        oid_from_str(&post_id).map_err(|_| ApiError::BadRequest("invalid post id".to_owned()))?;

    let post = state
        .mongo
        .collection::<Document>(POSTS_COLL)
        .find_one_and_delete(doc! { "_id": post_oid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_community_posts.find_one_and_delete"))?
        .ok_or_else(|| ApiError::NotFound("post not found".to_owned()))?;

    if let Ok(topic_oid) = post.get_object_id("topic_id") {
        let _ = state
            .mongo
            .collection::<Document>(TOPICS_COLL)
            .update_one(
                doc! { "_id": topic_oid, "tenant_id": tenant_id },
                doc! { "$inc": { "reply_count": -1_i64 }, "$set": { "updated_at": now_bson() } },
            )
            .await;
    }

    Ok(Json(SuccessResponse {
        message: "post deleted".to_owned(),
    }))
}

// ===========================================================================
// Shared vote toggler — used by both topic + post upvote endpoints.
// ===========================================================================

async fn toggle_vote(
    state: &SabChatCommunityState,
    coll: &str,
    tenant_id: ObjectId,
    doc_oid: ObjectId,
    voter: ObjectId,
) -> Result<Json<UpvoteResponse>> {
    let collection = state.mongo.collection::<Document>(coll);
    let existing = collection
        .find_one(doc! { "_id": doc_oid, "tenant_id": tenant_id })
        .await
        .map_err(internal("community.vote.find_one"))?
        .ok_or_else(|| ApiError::NotFound("not found".to_owned()))?;

    let voters: Vec<ObjectId> = existing
        .get_array("voters")
        .map(|arr| {
            arr.iter()
                .filter_map(|b| b.as_object_id())
                .collect::<Vec<_>>()
        })
        .unwrap_or_default();

    let already = voters.contains(&voter);
    let update = if already {
        doc! { "$pull": { "voters": voter }, "$inc": { "upvotes": -1_i64 } }
    } else {
        doc! { "$addToSet": { "voters": voter }, "$inc": { "upvotes": 1_i64 } }
    };
    collection
        .update_one(doc! { "_id": doc_oid, "tenant_id": tenant_id }, update)
        .await
        .map_err(internal("community.vote.update_one"))?;

    let new_count = (voters.len() as i64 + if already { -1 } else { 1 }).max(0);
    Ok(Json(UpvoteResponse {
        id: doc_oid.to_hex(),
        upvotes: new_count,
        voted: !already,
    }))
}
