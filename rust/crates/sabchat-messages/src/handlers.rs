//! HTTP handlers for the SabChat messages domain.
//!
//! Each handler maps to one route:
//!
//! | Endpoint                                | Handler                |
//! |-----------------------------------------|------------------------|
//! | `POST   /v1/sabchat/messages`           | [`append`]             |
//! | `GET    /v1/sabchat/messages`           | [`list`]               |
//! | `GET    /v1/sabchat/messages/:id`       | [`get_one`]            |
//! | `PATCH  /v1/sabchat/messages/:id`       | [`edit`]               |
//! | `DELETE /v1/sabchat/messages/:id`       | [`soft_delete`]        |
//!
//! ## Tenancy
//!
//! Every request scopes against `auth.tenant_id` parsed as an
//! `ObjectId`. The mutating endpoints additionally re-verify that the
//! resolved conversation / message lives under the caller's tenant
//! before any write happens.
//!
//! ## Side-effects
//!
//! On a successful non-private append we also patch the parent
//! conversation (`last_message_at`, `last_message_preview`,
//! `unread_count`, `first_response_at` on the first outbound message)
//! and write an audit event. Edits / deletes write audit events only.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::{Duration, Utc};
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use sabchat_types::{ContentBlock, SenderType};
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    AppendMessageBody, AppendMessageResponse, AppendSenderType, DEFAULT_LIST_LIMIT,
    EditMessageBody, GetMessageResponse, ListMessagesQuery, ListMessagesResponse, MAX_LIST_LIMIT,
    SuccessResponse,
};
use crate::preview::preview_for;
use crate::state::SabChatMessagesState;

// ===========================================================================
// Collection names
// ===========================================================================

const MESSAGES_COLL: &str = "sabchat_messages";
const CONVERSATIONS_COLL: &str = "sabchat_conversations";
const AUDIT_COLL: &str = "sabchat_audit_log";

/// Edit window (TS parity: 15 minutes from `created_at`).
const EDIT_WINDOW_MINUTES: i64 = 15;

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Load a conversation by id under the caller's tenant. Returns 404 if
/// the conversation does not exist, lives under a different tenant, or
/// the id is malformed.
async fn load_conversation_for_tenant(
    mongo: &MongoHandle,
    conversation_id_hex: &str,
    tenant_oid: ObjectId,
) -> Result<Document> {
    let oid = oid_from_str(conversation_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;
    let coll = mongo.collection::<Document>(CONVERSATIONS_COLL);
    coll.find_one(doc! { "_id": oid, "tenantId": tenant_oid })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_conversations.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Conversation not found.".to_owned()))
}

/// Convert the wire-level [`AppendSenderType`] into the domain
/// [`SenderType`].
fn map_sender_type(t: AppendSenderType) -> SenderType {
    match t {
        AppendSenderType::Agent => SenderType::Agent,
        AppendSenderType::Bot => SenderType::Bot,
        AppendSenderType::Visitor => SenderType::Visitor,
    }
}

/// Best-effort `ContentBlock` → `Bson` conversion via `serde_json`. The
/// content enum is fully serde-friendly so this always round-trips
/// cleanly; we fall back to `Bson::Null` only to keep the signature
/// total (never observed in practice).
fn content_to_bson(content: &ContentBlock) -> Bson {
    let value = serde_json::to_value(content).unwrap_or(serde_json::Value::Null);
    Bson::try_from(value).unwrap_or(Bson::Null)
}

/// Append one row to `sabchat_audit_log`. Errors are logged but not
/// propagated — audit failures must never fail the user-facing write
/// they were meant to record.
async fn write_audit(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    conversation_oid: ObjectId,
    contact_oid: ObjectId,
    inbox_oid: ObjectId,
    action: &str,
    actor_type: &str,
    actor_id: Option<ObjectId>,
) {
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut doc = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant_oid,
        "conversationId": conversation_oid,
        "contactId": contact_oid,
        "inboxId": inbox_oid,
        "action": action,
        "actorType": actor_type,
        "createdAt": now,
    };
    if let Some(actor) = actor_id {
        doc.insert("actorId", actor);
    }

    let coll = mongo.collection::<Document>(AUDIT_COLL);
    if let Err(err) = coll.insert_one(doc).await {
        tracing::warn!(
            audit.action = action,
            error.detail = %err,
            "failed to write sabchat audit event",
        );
    }
}

// ===========================================================================
// POST /v1/sabchat/messages — append
// ===========================================================================

/// `POST /v1/sabchat/messages` — append a message to a conversation.
///
/// Resolves the parent conversation under `auth.tenant_id`, derives
/// `direction` from `senderType`, persists the message, then patches the
/// conversation (preview / unread / first-response) and writes a
/// `message_sent` audit event.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id, sender = ?body.sender_type, private = body.private))]
pub async fn append(
    auth: AuthUser,
    State(state): State<SabChatMessagesState>,
    Json(body): Json<AppendMessageBody>,
) -> Result<Json<AppendMessageResponse>> {
    let tenant = tenant_oid(&auth)?;
    let conversation =
        load_conversation_for_tenant(&state.mongo, &body.conversation_id, tenant).await?;

    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let inbox_oid = conversation
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing inboxId")))?;
    let contact_oid = conversation
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing contactId")))?;

    let sender_type = map_sender_type(body.sender_type);

    // Direction: agent / bot / system → Outbound, visitor → Inbound.
    let direction_str = match sender_type {
        SenderType::Visitor => "inbound",
        SenderType::Agent | SenderType::Bot | SenderType::System => "outbound",
    };
    let is_outbound = direction_str == "outbound";

    // Resolve sender_id. For an agent fall back to the JWT subject; for
    // bot / visitor leave it None unless the caller passed an explicit id.
    let sender_id: Option<ObjectId> =
        match (sender_type, body.sender_id.as_deref()) {
            (_, Some(s)) if !s.is_empty() => Some(
                ObjectId::parse_str(s)
                    .map_err(|_| ApiError::BadRequest("Invalid sender id.".to_owned()))?,
            ),
            (SenderType::Agent, _) => Some(ObjectId::parse_str(&auth.user_id).map_err(|_| {
                ApiError::Unauthorized("subject is not a valid ObjectId".to_owned())
            })?),
            _ => None,
        };

    // ---- Insert the message --------------------------------------------
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let new_oid = ObjectId::new();

    let mut new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "inboxId": inbox_oid,
        "contactId": contact_oid,
        "senderType": match sender_type {
            SenderType::Visitor => "visitor",
            SenderType::Agent => "agent",
            SenderType::Bot => "bot",
            SenderType::System => "system",
        },
        "direction": direction_str,
        "content": content_to_bson(&body.content),
        "attachments": Bson::Array(vec![]),
        "providerMetadata": Bson::Null,
        "private": body.private,
        "createdAt": now_bson,
    };
    if let Some(sid) = sender_id {
        new_doc.insert("senderId", sid);
    }

    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    messages.insert_one(new_doc.clone()).await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.insert_one"))
    })?;

    // ---- Patch the parent conversation ---------------------------------
    //
    // Always bump `last_message_at` (so the inbox re-sorts even for
    // private notes). Preview + unread + first_response_at are skipped
    // for private notes.
    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    let mut set_doc = doc! { "lastMessageAt": now_bson, "updatedAt": now_bson };
    let mut inc_doc = doc! {};

    if !body.private {
        set_doc.insert("lastMessagePreview", preview_for(&body.content));

        // Inbound visitor messages bump the agent-side unread count.
        if !is_outbound {
            inc_doc.insert("unreadCount", 1i64);
        }

        // First outbound agent/bot message records first_response_at.
        if is_outbound {
            let already_set = conversation
                .get("firstResponseAt")
                .and_then(|b| match b {
                    Bson::Null => None,
                    other => Some(other),
                })
                .is_some();
            if !already_set {
                set_doc.insert("firstResponseAt", now_bson);
            }
        }
    }

    let mut update = doc! { "$set": set_doc };
    if !inc_doc.is_empty() {
        update.insert("$inc", inc_doc);
    }

    conversations
        .update_one(doc! { "_id": conversation_oid, "tenantId": tenant }, update)
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_conversations.update_one(append-sync)"),
            )
        })?;

    // ---- Audit ---------------------------------------------------------
    let actor_type = match sender_type {
        SenderType::Visitor => "visitor",
        SenderType::Agent => "agent",
        SenderType::Bot => "bot",
        SenderType::System => "system",
    };
    write_audit(
        &state.mongo,
        tenant,
        conversation_oid,
        contact_oid,
        inbox_oid,
        "message_sent",
        actor_type,
        sender_id,
    )
    .await;

    Ok(Json(AppendMessageResponse {
        message: document_to_clean_json(new_doc),
    }))
}

// ===========================================================================
// GET /v1/sabchat/messages — list
// ===========================================================================

/// `GET /v1/sabchat/messages` — newest-first paginated message list for
/// a single conversation. The conversation must belong to the caller's
/// tenant.
#[instrument(skip_all, fields(conversation_id = %query.conversation_id))]
pub async fn list(
    auth: AuthUser,
    State(state): State<SabChatMessagesState>,
    Query(query): Query<ListMessagesQuery>,
) -> Result<Json<ListMessagesResponse>> {
    let tenant = tenant_oid(&auth)?;

    // Tenant-scoped conversation existence check.
    let _ = load_conversation_for_tenant(&state.mongo, &query.conversation_id, tenant).await?;

    let conversation_oid = oid_from_str(&query.conversation_id)
        .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;

    // Build the filter — tenant scope + conversation scope + optional
    // `_id < beforeId` cursor.
    let mut filter = doc! {
        "tenantId": tenant,
        "conversationId": conversation_oid,
    };
    if let Some(before) = query.before_id.as_deref().filter(|s| !s.is_empty()) {
        let before_oid = oid_from_str(before)
            .map_err(|_| ApiError::BadRequest("Invalid beforeId cursor.".to_owned()))?;
        filter.insert("_id", doc! { "$lt": before_oid });
    }

    // Pagination — clamp to [1, MAX_LIST_LIMIT].
    let limit = query
        .limit
        .unwrap_or(DEFAULT_LIST_LIMIT)
        .clamp(1, MAX_LIST_LIMIT);

    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let cursor =
        coll.find(filter).with_options(opts).await.map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find"))
        })?;
    let docs: Vec<Document> = cursor.try_collect().await.map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.collect"))
    })?;

    let messages = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListMessagesResponse { messages }))
}

// ===========================================================================
// GET /v1/sabchat/messages/:id — get_one
// ===========================================================================

/// `GET /v1/sabchat/messages/:id` — fetch one message under the caller's
/// tenant. Returns 404 for both "does not exist" and "lives under a
/// different tenant" to avoid leaking existence across tenants.
#[instrument(skip_all, fields(message_id = %message_id))]
pub async fn get_one(
    auth: AuthUser,
    State(state): State<SabChatMessagesState>,
    Path(message_id): Path<String>,
) -> Result<Json<GetMessageResponse>> {
    let tenant = tenant_oid(&auth)?;
    let oid = oid_from_str(&message_id)
        .map_err(|_| ApiError::BadRequest("Invalid message id.".to_owned()))?;

    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let doc = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one"))
        })?
        .ok_or_else(|| ApiError::NotFound("Message not found.".to_owned()))?;

    Ok(Json(GetMessageResponse {
        message: document_to_clean_json(doc),
    }))
}

// ===========================================================================
// PATCH /v1/sabchat/messages/:id — edit
// ===========================================================================

/// `PATCH /v1/sabchat/messages/:id` — replace a message's content
/// block.
///
/// Edits are gated by two rules:
/// 1. The caller must be the original sender (`sender_id == auth.user_id`).
/// 2. The edit must occur within [`EDIT_WINDOW_MINUTES`] of `created_at`.
///
/// On success we set the new `content`, stamp `updated_at`, and write a
/// `message_edited` audit event.
#[instrument(skip_all, fields(message_id = %message_id))]
pub async fn edit(
    auth: AuthUser,
    State(state): State<SabChatMessagesState>,
    Path(message_id): Path<String>,
    Json(body): Json<EditMessageBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&auth)?;
    let oid = oid_from_str(&message_id)
        .map_err(|_| ApiError::BadRequest("Invalid message id.".to_owned()))?;
    let user_oid = ObjectId::parse_str(&auth.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let existing = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one(edit)"))
        })?
        .ok_or_else(|| ApiError::NotFound("Message not found.".to_owned()))?;

    // Sender check.
    let sender_id = existing.get_object_id("senderId").ok();
    if sender_id != Some(user_oid) {
        return Err(ApiError::Forbidden(
            "Only the original sender can edit this message.".to_owned(),
        ));
    }

    // Edit-window check.
    let created_at = existing
        .get_datetime("createdAt")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing createdAt")))?
        .to_chrono();
    if Utc::now() - created_at > Duration::minutes(EDIT_WINDOW_MINUTES) {
        return Err(ApiError::Forbidden(format!(
            "Messages can only be edited within {EDIT_WINDOW_MINUTES} minutes of sending.",
        )));
    }

    // Resolve side-effect ids before the write so audit always fires
    // against the right conversation even if the doc changes underneath us.
    let conversation_oid = existing
        .get_object_id("conversationId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?;
    let contact_oid = existing
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing contactId")))?;
    let inbox_oid = existing
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing inboxId")))?;
    let private = existing.get_bool("private").unwrap_or(false);

    // Persist the new content block + an `updatedAt` stamp. `updatedAt`
    // is not modelled on `SabChatMessage` — we attach it dynamically via
    // `$set` so existing readers ignore it and future migrations can
    // adopt it without a schema rev.
    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let update = doc! {
        "$set": {
            "content": content_to_bson(&body.content),
            "updatedAt": now_bson,
        },
    };
    coll.update_one(doc! { "_id": oid, "tenantId": tenant }, update)
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.update_one(edit)"))
        })?;

    // If this message is the one currently previewed on the parent
    // conversation, refresh the preview so the inbox row stays in sync.
    // We keep the heuristic cheap: only refresh on non-private edits and
    // only if the message's `createdAt` matches the conversation's
    // `lastMessageAt`.
    if !private {
        let created_bson = existing
            .get_datetime("createdAt")
            .map(|dt| Bson::DateTime(*dt))
            .unwrap_or(Bson::Null);
        let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
        let _ = conversations
            .update_one(
                doc! {
                    "_id": conversation_oid,
                    "tenantId": tenant,
                    "lastMessageAt": created_bson,
                },
                doc! { "$set": { "lastMessagePreview": preview_for(&body.content) } },
            )
            .await;
    }

    write_audit(
        &state.mongo,
        tenant,
        conversation_oid,
        contact_oid,
        inbox_oid,
        "message_edited",
        "agent",
        Some(user_oid),
    )
    .await;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// DELETE /v1/sabchat/messages/:id — soft_delete
// ===========================================================================

/// `DELETE /v1/sabchat/messages/:id` — soft-delete by replacing the
/// content block with a `System { text: "(deleted)" }` tombstone.
///
/// The document remains in `sabchat_messages` so cursors and reply
/// chains stay stable; only the rendered content changes. Writes a
/// `message_deleted` audit event.
#[instrument(skip_all, fields(message_id = %message_id))]
pub async fn soft_delete(
    auth: AuthUser,
    State(state): State<SabChatMessagesState>,
    Path(message_id): Path<String>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&auth)?;
    let oid = oid_from_str(&message_id)
        .map_err(|_| ApiError::BadRequest("Invalid message id.".to_owned()))?;

    let coll = state.mongo.collection::<Document>(MESSAGES_COLL);
    let existing = coll
        .find_one(doc! { "_id": oid, "tenantId": tenant })
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.find_one(delete)"))
        })?
        .ok_or_else(|| ApiError::NotFound("Message not found.".to_owned()))?;

    let conversation_oid = existing
        .get_object_id("conversationId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing conversationId")))?;
    let contact_oid = existing
        .get_object_id("contactId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing contactId")))?;
    let inbox_oid = existing
        .get_object_id("inboxId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("message missing inboxId")))?;

    let tombstone = ContentBlock::System {
        text: "(deleted)".to_owned(),
    };
    let now_bson = bson::DateTime::from_chrono(Utc::now());

    coll.update_one(
        doc! { "_id": oid, "tenantId": tenant },
        doc! { "$set": {
            "content": content_to_bson(&tombstone),
            "updatedAt": now_bson,
        } },
    )
    .await
    .map_err(|e| {
        ApiError::Internal(anyhow::Error::new(e).context("sabchat_messages.update_one(delete)"))
    })?;

    let actor_oid = ObjectId::parse_str(&auth.user_id).ok();
    write_audit(
        &state.mongo,
        tenant,
        conversation_oid,
        contact_oid,
        inbox_oid,
        "message_deleted",
        "agent",
        actor_oid,
    )
    .await;

    Ok(Json(SuccessResponse::ok()))
}
