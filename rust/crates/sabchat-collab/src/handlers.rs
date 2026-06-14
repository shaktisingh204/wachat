//! HTTP handlers for the SabChat **collaboration** domain.
//!
//! | Collection                      | Direction | Notes                       |
//! |---------------------------------|-----------|-----------------------------|
//! | `sabchat_side_conversations`    | r/w       | internal side-threads       |
//! | `sabchat_side_messages`         | r/w       | replies on a side-thread    |
//! | `sabchat_conversation_links`    | r/w       | conversation ↔ conversation |
//!
//! Every read and write filters on `tenant_id = ObjectId(auth.tenant_id)`.

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
    CreateLinkBody, CreateSideBody, CreateSideMessageBody, IdResponse, LinksQuery,
    ListLinksResponse, ListSideMessagesResponse, ListSideResponse, SideListQuery, SuccessResponse,
};
use crate::state::SabChatCollabState;

const SIDE_COLL: &str = "sabchat_side_conversations";
const SIDE_MSG_COLL: &str = "sabchat_side_messages";
const LINKS_COLL: &str = "sabchat_conversation_links";

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
// Side conversations
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_side(
    user: AuthUser,
    State(state): State<SabChatCollabState>,
    Json(body): Json<CreateSideBody>,
) -> Result<Json<IdResponse>> {
    let subject = body.subject.trim();
    if subject.is_empty() {
        return Err(ApiError::Validation("subject is required".to_owned()));
    }
    let parent = oid_from_str(&body.parent_conversation_id)
        .map_err(|_| ApiError::BadRequest("invalid parentConversationId".to_owned()))?;

    let tenant_id = tenant_oid(&user)?;
    let author = author_oid(&user)?;
    let now = now_bson();
    let new_oid = ObjectId::new();
    let doc = doc! {
        "_id": new_oid,
        "tenant_id": tenant_id,
        "parent_conversation_id": parent,
        "subject": subject,
        "created_by": author,
        "message_count": 0_i64,
        "created_at": now,
        "updated_at": now,
    };
    state
        .mongo
        .collection::<Document>(SIDE_COLL)
        .insert_one(doc)
        .await
        .map_err(internal("sabchat_side_conversations.insert_one"))?;
    Ok(Json(IdResponse {
        id: new_oid.to_hex(),
    }))
}

#[instrument(skip_all)]
pub async fn list_side(
    user: AuthUser,
    State(state): State<SabChatCollabState>,
    Query(q): Query<SideListQuery>,
) -> Result<Json<ListSideResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let parent = oid_from_str(&q.parent_conversation_id)
        .map_err(|_| ApiError::BadRequest("invalid parentConversationId".to_owned()))?;
    let opts = FindOptions::builder().sort(doc! { "created_at": -1 }).build();
    let cursor = state
        .mongo
        .collection::<Document>(SIDE_COLL)
        .find(doc! { "tenant_id": tenant_id, "parent_conversation_id": parent })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_side_conversations.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_side_conversations.collect"))?;
    Ok(Json(ListSideResponse {
        side_conversations: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

#[instrument(skip_all, fields(side_id = %side_id))]
pub async fn delete_side(
    user: AuthUser,
    State(state): State<SabChatCollabState>,
    Path(side_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let sid = oid_from_str(&side_id)
        .map_err(|_| ApiError::BadRequest("invalid side id".to_owned()))?;
    let res = state
        .mongo
        .collection::<Document>(SIDE_COLL)
        .delete_one(doc! { "_id": sid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_side_conversations.delete_one"))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("side conversation not found".to_owned()));
    }
    let _ = state
        .mongo
        .collection::<Document>(SIDE_MSG_COLL)
        .delete_many(doc! { "tenant_id": tenant_id, "side_conversation_id": sid })
        .await;
    Ok(Json(SuccessResponse {
        message: "side conversation deleted".to_owned(),
    }))
}

#[instrument(skip_all, fields(side_id = %side_id))]
pub async fn list_side_messages(
    user: AuthUser,
    State(state): State<SabChatCollabState>,
    Path(side_id): Path<String>,
) -> Result<Json<ListSideMessagesResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let sid = oid_from_str(&side_id)
        .map_err(|_| ApiError::BadRequest("invalid side id".to_owned()))?;
    let opts = FindOptions::builder().sort(doc! { "created_at": 1 }).build();
    let cursor = state
        .mongo
        .collection::<Document>(SIDE_MSG_COLL)
        .find(doc! { "tenant_id": tenant_id, "side_conversation_id": sid })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_side_messages.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_side_messages.collect"))?;
    Ok(Json(ListSideMessagesResponse {
        messages: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

#[instrument(skip_all, fields(side_id = %side_id))]
pub async fn create_side_message(
    user: AuthUser,
    State(state): State<SabChatCollabState>,
    Path(side_id): Path<String>,
    Json(body): Json<CreateSideMessageBody>,
) -> Result<Json<IdResponse>> {
    let text = body.body.trim();
    if text.is_empty() {
        return Err(ApiError::Validation("body is required".to_owned()));
    }
    let tenant_id = tenant_oid(&user)?;
    let author = author_oid(&user)?;
    let sid = oid_from_str(&side_id)
        .map_err(|_| ApiError::BadRequest("invalid side id".to_owned()))?;

    let exists = state
        .mongo
        .collection::<Document>(SIDE_COLL)
        .find_one(doc! { "_id": sid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_side_conversations.find_one"))?
        .is_some();
    if !exists {
        return Err(ApiError::NotFound("side conversation not found".to_owned()));
    }

    let now = now_bson();
    let new_oid = ObjectId::new();
    state
        .mongo
        .collection::<Document>(SIDE_MSG_COLL)
        .insert_one(doc! {
            "_id": new_oid,
            "tenant_id": tenant_id,
            "side_conversation_id": sid,
            "body": text,
            "author_id": author,
            "author_name": body.author_name.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            "created_at": now,
        })
        .await
        .map_err(internal("sabchat_side_messages.insert_one"))?;
    let _ = state
        .mongo
        .collection::<Document>(SIDE_COLL)
        .update_one(
            doc! { "_id": sid, "tenant_id": tenant_id },
            doc! { "$inc": { "message_count": 1_i64 }, "$set": { "updated_at": now } },
        )
        .await;
    Ok(Json(IdResponse {
        id: new_oid.to_hex(),
    }))
}

// ===========================================================================
// Conversation links
// ===========================================================================

#[instrument(skip_all)]
pub async fn create_link(
    user: AuthUser,
    State(state): State<SabChatCollabState>,
    Json(body): Json<CreateLinkBody>,
) -> Result<Json<IdResponse>> {
    let a = oid_from_str(&body.a_id).map_err(|_| ApiError::BadRequest("invalid aId".to_owned()))?;
    let b = oid_from_str(&body.b_id).map_err(|_| ApiError::BadRequest("invalid bId".to_owned()))?;
    if a == b {
        return Err(ApiError::BadRequest("cannot link a conversation to itself".to_owned()));
    }
    let tenant_id = tenant_oid(&user)?;

    // Dedupe — a link is undirected, so check both orderings.
    let dup = state
        .mongo
        .collection::<Document>(LINKS_COLL)
        .find_one(doc! {
            "tenant_id": tenant_id,
            "$or": [
                doc! { "a_id": a, "b_id": b },
                doc! { "a_id": b, "b_id": a },
            ],
        })
        .await
        .map_err(internal("sabchat_conversation_links.find_one"))?;
    if let Some(existing) = dup {
        if let Ok(id) = existing.get_object_id("_id") {
            return Ok(Json(IdResponse { id: id.to_hex() }));
        }
    }

    let now = now_bson();
    let new_oid = ObjectId::new();
    state
        .mongo
        .collection::<Document>(LINKS_COLL)
        .insert_one(doc! {
            "_id": new_oid,
            "tenant_id": tenant_id,
            "a_id": a,
            "b_id": b,
            "note": body.note.as_deref().map(str::trim).filter(|s| !s.is_empty()),
            "created_by": author_oid(&user)?,
            "created_at": now,
        })
        .await
        .map_err(internal("sabchat_conversation_links.insert_one"))?;
    Ok(Json(IdResponse {
        id: new_oid.to_hex(),
    }))
}

#[instrument(skip_all)]
pub async fn list_links(
    user: AuthUser,
    State(state): State<SabChatCollabState>,
    Query(q): Query<LinksQuery>,
) -> Result<Json<ListLinksResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let conv = oid_from_str(&q.conversation_id)
        .map_err(|_| ApiError::BadRequest("invalid conversationId".to_owned()))?;
    let opts = FindOptions::builder().sort(doc! { "created_at": -1 }).build();
    let cursor = state
        .mongo
        .collection::<Document>(LINKS_COLL)
        .find(doc! {
            "tenant_id": tenant_id,
            "$or": [ doc! { "a_id": conv }, doc! { "b_id": conv } ],
        })
        .with_options(opts)
        .await
        .map_err(internal("sabchat_conversation_links.find"))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(internal("sabchat_conversation_links.collect"))?;
    Ok(Json(ListLinksResponse {
        links: docs.into_iter().map(document_to_clean_json).collect(),
    }))
}

#[instrument(skip_all, fields(link_id = %link_id))]
pub async fn delete_link(
    user: AuthUser,
    State(state): State<SabChatCollabState>,
    Path(link_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant_id = tenant_oid(&user)?;
    let lid = oid_from_str(&link_id)
        .map_err(|_| ApiError::BadRequest("invalid link id".to_owned()))?;
    let res = state
        .mongo
        .collection::<Document>(LINKS_COLL)
        .delete_one(doc! { "_id": lid, "tenant_id": tenant_id })
        .await
        .map_err(internal("sabchat_conversation_links.delete_one"))?;
    if res.deleted_count == 0 {
        return Err(ApiError::NotFound("link not found".to_owned()));
    }
    Ok(Json(SuccessResponse {
        message: "link removed".to_owned(),
    }))
}
