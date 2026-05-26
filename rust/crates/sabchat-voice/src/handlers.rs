//! HTTP handlers for the SabChat voice / video calling domain.
//!
//! Each handler maps to one route registered in [`crate::router`]:
//!
//! | Endpoint                                            | Handler            |
//! |-----------------------------------------------------|--------------------|
//! | `POST   /v1/sabchat/voice/calls`                    | [`start`]          |
//! | `POST   /v1/sabchat/voice/calls/{id}/answer`        | [`answer`]         |
//! | `POST   /v1/sabchat/voice/calls/{id}/end`           | [`end`]            |
//! | `POST   /v1/sabchat/voice/calls/{id}/fail`          | [`fail`]           |
//! | `GET    /v1/sabchat/voice/calls`                    | [`list`]           |
//! | `GET    /v1/sabchat/voice/calls/{id}`               | [`get_one`]        |
//! | `GET    /v1/sabchat/voice/token`                    | [`token`]          |
//!
//! ## Tenancy
//!
//! Every request scopes against `auth.tenant_id` parsed as an `ObjectId`.
//! Mutating endpoints additionally re-verify that the resolved
//! conversation / call lives under the caller's tenant before any write
//! happens.
//!
//! ## Side-effects on `end`
//!
//! Ending a call posts a `ContentBlock::System` row to `sabchat_messages`
//! (so the inbox previews "voice call ended (42s)"), patches the parent
//! conversation's `lastMessageAt` / `lastMessagePreview` / `updatedAt`,
//! and writes a `message_sent` audit row. Audit + ancillary writes mirror
//! the `sabchat-messages` contract — failures are logged, never
//! propagated.

use axum::{
    Json,
    extract::{Path, Query, State},
};
use bson::{Bson, Document, doc, oid::ObjectId};
use chrono::Utc;
use futures::TryStreamExt;
use mongodb::options::FindOptions;
use rand::RngCore;
use sabchat_types::ContentBlock;
use sabnode_auth::AuthUser;
use sabnode_common::{ApiError, Result};
use sabnode_db::{bson_helpers::oid_from_str, document_to_clean_json, mongo::MongoHandle};
use tracing::instrument;

use crate::dto::{
    AnswerCallBody, CallKind, DEFAULT_LIMIT, EndCallBody, FailCallBody, ListCallsQuery,
    ListCallsResponse, MAX_LIMIT, StartCallBody, StartCallResponse, SuccessResponse, TokenQuery,
    TokenResponse,
};
use crate::state::SabChatVoiceState;
use crate::{AUDIT_COLL, CALLS_COLL, CONVERSATIONS_COLL, MESSAGES_COLL};

// ===========================================================================
// Helpers
// ===========================================================================

/// Parse `auth.tenant_id` into an `ObjectId` or fail with 401.
fn tenant_oid(auth: &AuthUser) -> Result<ObjectId> {
    ObjectId::parse_str(&auth.tenant_id)
        .map_err(|_| ApiError::Unauthorized("tenant id is not a valid ObjectId".to_owned()))
}

/// Generate a 32-hex-char cryptographically-strong room id. Uses
/// `rand::thread_rng` so we don't pay an `OsRng` syscall per call.
fn new_room_id() -> String {
    let mut bytes = [0u8; 16];
    rand::thread_rng().fill_bytes(&mut bytes);
    hex_encode(&bytes)
}

/// Tiny lowercase hex encoder — `rand` is already in the dep set, no
/// reason to pull in the `hex` crate for sixteen bytes.
fn hex_encode(bytes: &[u8]) -> String {
    const HEX: &[u8; 16] = b"0123456789abcdef";
    let mut out = String::with_capacity(bytes.len() * 2);
    for b in bytes {
        out.push(HEX[(b >> 4) as usize] as char);
        out.push(HEX[(b & 0x0f) as usize] as char);
    }
    out
}

/// Load a call by id under the caller's tenant. Returns 404 if the call
/// does not exist, lives under a different tenant, or the id is
/// malformed.
async fn load_call_for_tenant(
    mongo: &MongoHandle,
    call_id_hex: &str,
    tenant_oid: ObjectId,
) -> Result<Document> {
    let oid = oid_from_str(call_id_hex)
        .map_err(|_| ApiError::BadRequest("Invalid call id.".to_owned()))?;
    let coll = mongo.collection::<Document>(CALLS_COLL);
    coll.find_one(doc! { "_id": oid, "tenantId": tenant_oid })
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_calls.find_one")))?
        .ok_or_else(|| ApiError::NotFound("Call not found.".to_owned()))
}

/// Load a conversation by id under the caller's tenant.
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

/// Best-effort `ContentBlock` → `Bson` conversion via `serde_json`. The
/// content enum is fully serde-friendly so this always round-trips
/// cleanly; the fallback to `Bson::Null` is just to keep the signature
/// total.
fn content_to_bson(content: &ContentBlock) -> Bson {
    let value = serde_json::to_value(content).unwrap_or(serde_json::Value::Null);
    Bson::try_from(value).unwrap_or(Bson::Null)
}

/// Map the stored `kind` string back into a `CallKind` label, falling
/// back to the literal string when the field is missing or unrecognised.
fn kind_label_from_doc(call: &Document) -> &'static str {
    match call.get_str("kind").ok() {
        Some("video") => "video",
        _ => "voice",
    }
}

/// Append one row to `sabchat_audit_log`. Errors are logged but not
/// propagated — audit failures must never fail the user-facing write
/// they were meant to record.
async fn write_audit(
    mongo: &MongoHandle,
    tenant_oid: ObjectId,
    conversation_oid: ObjectId,
    contact_oid: Option<ObjectId>,
    inbox_oid: Option<ObjectId>,
    action: &str,
    actor_type: &str,
    actor_id: Option<ObjectId>,
) {
    let now = bson::DateTime::from_chrono(Utc::now());
    let mut doc = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant_oid,
        "conversationId": conversation_oid,
        "action": action,
        "actorType": actor_type,
        "createdAt": now,
    };
    if let Some(c) = contact_oid {
        doc.insert("contactId", c);
    }
    if let Some(i) = inbox_oid {
        doc.insert("inboxId", i);
    }
    if let Some(actor) = actor_id {
        doc.insert("actorId", actor);
    }

    let coll = mongo.collection::<Document>(AUDIT_COLL);
    if let Err(err) = coll.insert_one(doc).await {
        tracing::warn!(
            audit.action = action,
            error.detail = %err,
            "failed to write sabchat voice audit event",
        );
    }
}

// ===========================================================================
// POST /v1/sabchat/voice/calls — start
// ===========================================================================

/// `POST /v1/sabchat/voice/calls` — create a new ringing call against an
/// existing conversation. Returns the new call id, the freshly-generated
/// 32-hex-char room id, and a (stub) provider access token.
#[instrument(skip_all, fields(conversation_id = %body.conversation_id, kind = ?body.kind))]
pub async fn start(
    auth: AuthUser,
    State(state): State<SabChatVoiceState>,
    Json(body): Json<StartCallBody>,
) -> Result<Json<StartCallResponse>> {
    let tenant = tenant_oid(&auth)?;
    let conversation =
        load_conversation_for_tenant(&state.mongo, &body.conversation_id, tenant).await?;

    let conversation_oid = conversation
        .get_object_id("_id")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("conversation missing _id")))?;
    let inbox_oid = conversation.get_object_id("inboxId").ok();
    let contact_oid = conversation.get_object_id("contactId").ok();

    let initiator_oid = ObjectId::parse_str(&auth.user_id)
        .map_err(|_| ApiError::Unauthorized("subject is not a valid ObjectId".to_owned()))?;

    let now = Utc::now();
    let now_bson = bson::DateTime::from_chrono(now);
    let new_oid = ObjectId::new();
    let room_id = new_room_id();

    let mut new_doc = doc! {
        "_id": new_oid,
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "kind": body.kind.as_str(),
        "status": "ringing",
        "roomId": &room_id,
        "initiatorType": "agent",
        "initiatorId": initiator_oid,
        "createdAt": now_bson,
        "updatedAt": now_bson,
    };
    if let Some(i) = inbox_oid {
        new_doc.insert("inboxId", i);
    }
    if let Some(c) = contact_oid {
        new_doc.insert("contactId", c);
    }

    let calls = state.mongo.collection::<Document>(CALLS_COLL);
    calls
        .insert_one(new_doc)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_calls.insert_one")))?;

    Ok(Json(StartCallResponse {
        call_id: new_oid.to_hex(),
        room_id,
        token: "stub".to_owned(),
    }))
}

// ===========================================================================
// POST /v1/sabchat/voice/calls/{id}/answer
// ===========================================================================

/// `POST /v1/sabchat/voice/calls/{id}/answer` — flip the call to
/// `ongoing` and stamp `startedAt` server-side.
#[instrument(skip_all, fields(call_id = %call_id))]
pub async fn answer(
    auth: AuthUser,
    State(state): State<SabChatVoiceState>,
    Path(call_id): Path<String>,
    Json(_body): Json<AnswerCallBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&auth)?;
    let _ = load_call_for_tenant(&state.mongo, &call_id, tenant).await?;
    let oid = oid_from_str(&call_id)
        .map_err(|_| ApiError::BadRequest("Invalid call id.".to_owned()))?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let calls = state.mongo.collection::<Document>(CALLS_COLL);
    calls
        .update_one(
            doc! { "_id": oid, "tenantId": tenant },
            doc! { "$set": {
                "status": "ongoing",
                "startedAt": now_bson,
                "updatedAt": now_bson,
            } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(
                anyhow::Error::new(e).context("sabchat_calls.update_one(answer)"),
            )
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/sabchat/voice/calls/{id}/end
// ===========================================================================

/// `POST /v1/sabchat/voice/calls/{id}/end` — mark the call as `ended`,
/// stamp `endedAt`, derive `durationS` from `endedAt - startedAt` (when
/// `startedAt` is present), persist an optional `recordingUrl`, post a
/// `ContentBlock::System` message into the parent conversation, patch
/// `lastMessageAt` / `lastMessagePreview` / `updatedAt`, and write a
/// `message_sent` audit row.
#[instrument(skip_all, fields(call_id = %call_id))]
pub async fn end(
    auth: AuthUser,
    State(state): State<SabChatVoiceState>,
    Path(call_id): Path<String>,
    Json(body): Json<EndCallBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&auth)?;
    let existing = load_call_for_tenant(&state.mongo, &call_id, tenant).await?;
    let oid = oid_from_str(&call_id)
        .map_err(|_| ApiError::BadRequest("Invalid call id.".to_owned()))?;

    let conversation_oid = existing
        .get_object_id("conversationId")
        .map_err(|_| ApiError::Internal(anyhow::anyhow!("call missing conversationId")))?;
    let inbox_oid = existing.get_object_id("inboxId").ok();
    let contact_oid = existing.get_object_id("contactId").ok();
    let kind_label = kind_label_from_doc(&existing);

    let ended_at = Utc::now();
    let ended_at_bson = bson::DateTime::from_chrono(ended_at);

    // Derive durationS from startedAt when present. We compute against
    // the stored value rather than trusting client clock skew.
    let started_at = existing.get_datetime("startedAt").ok().map(|dt| dt.to_chrono());
    let duration_s: Option<i64> = started_at.map(|s| (ended_at - s).num_seconds().max(0));

    let mut set_doc = doc! {
        "status": "ended",
        "endedAt": ended_at_bson,
        "updatedAt": ended_at_bson,
    };
    if let Some(d) = duration_s {
        set_doc.insert("durationS", d);
    }
    if let Some(url) = body.recording_url.as_deref().filter(|s| !s.is_empty()) {
        set_doc.insert("recordingUrl", url);
    }

    let calls = state.mongo.collection::<Document>(CALLS_COLL);
    calls
        .update_one(
            doc! { "_id": oid, "tenantId": tenant },
            doc! { "$set": set_doc },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_calls.update_one(end)"))
        })?;

    // ---- System message into the conversation --------------------------
    //
    // Best-effort: a Mongo error here must NOT roll back the ended state
    // we just persisted. Mirrors `sabchat-messages` write_audit contract
    // applied to the side-effect itself.
    let preview_text = match duration_s {
        Some(d) => format!("{} call ended ({}s)", kind_label, d),
        None => format!("{} call ended", kind_label),
    };

    let actor_oid = ObjectId::parse_str(&auth.user_id).ok();

    let content = ContentBlock::System {
        text: preview_text.clone(),
    };
    let messages = state.mongo.collection::<Document>(MESSAGES_COLL);
    let mut msg_doc = doc! {
        "_id": ObjectId::new(),
        "tenantId": tenant,
        "conversationId": conversation_oid,
        "senderType": "system",
        "direction": "outbound",
        "content": content_to_bson(&content),
        "attachments": Bson::Array(vec![]),
        "providerMetadata": Bson::Null,
        "private": false,
        "createdAt": ended_at_bson,
    };
    if let Some(i) = inbox_oid {
        msg_doc.insert("inboxId", i);
    }
    if let Some(c) = contact_oid {
        msg_doc.insert("contactId", c);
    }

    if let Err(err) = messages.insert_one(msg_doc).await {
        tracing::warn!(
            error.detail = %err,
            "failed to write call-ended system message",
        );
    }

    // ---- Patch the parent conversation ---------------------------------
    let conversations = state.mongo.collection::<Document>(CONVERSATIONS_COLL);
    if let Err(err) = conversations
        .update_one(
            doc! { "_id": conversation_oid, "tenantId": tenant },
            doc! { "$set": {
                "lastMessageAt": ended_at_bson,
                "lastMessagePreview": &preview_text,
                "updatedAt": ended_at_bson,
            } },
        )
        .await
    {
        tracing::warn!(
            error.detail = %err,
            "failed to patch conversation after call end",
        );
    }

    // ---- Audit ---------------------------------------------------------
    write_audit(
        &state.mongo,
        tenant,
        conversation_oid,
        contact_oid,
        inbox_oid,
        "message_sent",
        "system",
        actor_oid,
    )
    .await;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// POST /v1/sabchat/voice/calls/{id}/fail
// ===========================================================================

/// `POST /v1/sabchat/voice/calls/{id}/fail` — mark the call as `failed`
/// and persist the caller's reason as `failureReason`.
#[instrument(skip_all, fields(call_id = %call_id))]
pub async fn fail(
    auth: AuthUser,
    State(state): State<SabChatVoiceState>,
    Path(call_id): Path<String>,
    Json(body): Json<FailCallBody>,
) -> Result<Json<SuccessResponse>> {
    let tenant = tenant_oid(&auth)?;
    let _ = load_call_for_tenant(&state.mongo, &call_id, tenant).await?;
    let oid = oid_from_str(&call_id)
        .map_err(|_| ApiError::BadRequest("Invalid call id.".to_owned()))?;

    let now_bson = bson::DateTime::from_chrono(Utc::now());
    let calls = state.mongo.collection::<Document>(CALLS_COLL);
    calls
        .update_one(
            doc! { "_id": oid, "tenantId": tenant },
            doc! { "$set": {
                "status": "failed",
                "failureReason": body.reason,
                "updatedAt": now_bson,
            } },
        )
        .await
        .map_err(|e| {
            ApiError::Internal(anyhow::Error::new(e).context("sabchat_calls.update_one(fail)"))
        })?;

    Ok(Json(SuccessResponse::ok()))
}

// ===========================================================================
// GET /v1/sabchat/voice/calls — list
// ===========================================================================

/// `GET /v1/sabchat/voice/calls` — newest-first paginated call list for
/// the caller's tenant, optionally filtered by `conversationId` and/or
/// `status`. Pagination is `_id`-cursor: pass the previous page's
/// `nextCursor` back as `cursor`.
#[instrument(skip_all, fields(conversation_id = ?query.conversation_id, status = ?query.status))]
pub async fn list(
    auth: AuthUser,
    State(state): State<SabChatVoiceState>,
    Query(query): Query<ListCallsQuery>,
) -> Result<Json<ListCallsResponse>> {
    let tenant = tenant_oid(&auth)?;

    let mut filter = doc! { "tenantId": tenant };
    if let Some(conv) = query.conversation_id.as_deref().filter(|s| !s.is_empty()) {
        let conv_oid = oid_from_str(conv)
            .map_err(|_| ApiError::BadRequest("Invalid conversation id.".to_owned()))?;
        filter.insert("conversationId", conv_oid);
    }
    if let Some(status) = query.status.as_deref().filter(|s| !s.is_empty()) {
        filter.insert("status", status);
    }
    if let Some(cursor) = query.cursor.as_deref().filter(|s| !s.is_empty()) {
        let cursor_oid = oid_from_str(cursor)
            .map_err(|_| ApiError::BadRequest("Invalid cursor.".to_owned()))?;
        filter.insert("_id", doc! { "$lt": cursor_oid });
    }

    let limit = if query.limit <= 0 {
        DEFAULT_LIMIT
    } else {
        query.limit.min(MAX_LIMIT)
    };

    let opts = FindOptions::builder()
        .sort(doc! { "_id": -1 })
        .limit(limit)
        .build();

    let coll = state.mongo.collection::<Document>(CALLS_COLL);
    let cursor = coll
        .find(filter)
        .with_options(opts)
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_calls.find")))?;
    let docs: Vec<Document> = cursor
        .try_collect()
        .await
        .map_err(|e| ApiError::Internal(anyhow::Error::new(e).context("sabchat_calls.collect")))?;

    let next_cursor = if (docs.len() as i64) == limit {
        docs.last()
            .and_then(|d| d.get_object_id("_id").ok())
            .map(|o| o.to_hex())
    } else {
        None
    };

    let calls = docs.into_iter().map(document_to_clean_json).collect();
    Ok(Json(ListCallsResponse { calls, next_cursor }))
}

// ===========================================================================
// GET /v1/sabchat/voice/calls/{id} — get_one
// ===========================================================================

/// `GET /v1/sabchat/voice/calls/{id}` — fetch one call under the caller's
/// tenant. Returns 404 for both "does not exist" and "lives under a
/// different tenant" to avoid leaking existence across tenants.
#[instrument(skip_all, fields(call_id = %call_id))]
pub async fn get_one(
    auth: AuthUser,
    State(state): State<SabChatVoiceState>,
    Path(call_id): Path<String>,
) -> Result<Json<serde_json::Value>> {
    let tenant = tenant_oid(&auth)?;
    let doc = load_call_for_tenant(&state.mongo, &call_id, tenant).await?;
    Ok(Json(document_to_clean_json(doc)))
}

// ===========================================================================
// GET /v1/sabchat/voice/token — re-issue room token
// ===========================================================================

/// `GET /v1/sabchat/voice/token?callId=...` — re-issue a provider room
/// token for an existing call. Returns the stub literal `"stub"` today;
/// the call must exist under the caller's tenant so a leaked `callId`
/// from another tenant cannot mint tokens.
#[instrument(skip_all, fields(call_id = %query.call_id))]
pub async fn token(
    auth: AuthUser,
    State(state): State<SabChatVoiceState>,
    Query(query): Query<TokenQuery>,
) -> Result<Json<TokenResponse>> {
    let tenant = tenant_oid(&auth)?;
    let _ = load_call_for_tenant(&state.mongo, &query.call_id, tenant).await?;
    Ok(Json(TokenResponse {
        token: "stub".to_owned(),
    }))
}

// Suppress unused-import warning when `CallKind` is only referenced via
// the `?` debug formatter in `#[instrument]` macro expansion.
#[allow(dead_code)]
fn _kind_ref(_k: CallKind) {}
