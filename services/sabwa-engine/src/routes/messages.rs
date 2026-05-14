//! `/messages` — message history, send, edit, react, star, search.
//!
//! Implements server actions from SABWA_PLAN.md §13: `getChatMessages`,
//! `sendMessage`, `markRead` plus edit / react / star / delete and the
//! starred + search read endpoints.

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Json, Router,
};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::error::AppError;
use crate::state::AppState;

/// Build the `/messages` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_messages).post(send_message))
        .route("/:id", axum::routing::patch(patch_message))
        .route("/mark-read", post(mark_read))
        .route("/starred", get(list_starred))
        .route("/search", get(search_messages))
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesQuery {
    pub session_id: String,
    pub chat_jid: String,
    /// Page back from this timestamp (exclusive). Returns newest-first.
    #[serde(default)]
    pub before: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MessageDto {
    pub message_id: String,
    pub chat_jid: String,
    pub from_jid: String,
    pub from_me: bool,
    pub r#type: String,
    pub body: Option<String>,
    pub media_url: Option<String>,
    pub media_mime: Option<String>,
    pub caption: Option<String>,
    pub quoted_message_id: Option<String>,
    pub status: String,
    pub starred: bool,
    pub forwarded: bool,
    pub ts: chrono::DateTime<chrono::Utc>,
    pub edited_at: Option<chrono::DateTime<chrono::Utc>>,
    pub deleted_at: Option<chrono::DateTime<chrono::Utc>>,
    #[serde(default)]
    pub reactions: Vec<JsonValue>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListMessagesResponse {
    pub messages: Vec<MessageDto>,
    pub next_cursor: Option<chrono::DateTime<chrono::Utc>>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageRequest {
    pub session_id: String,
    pub chat_jid: String,
    /// `text` | `image` | `video` | `audio` | `voice` | `document` | `sticker` | `location` | `poll`.
    pub r#type: String,
    pub body: Option<String>,
    pub media_url: Option<String>,
    pub caption: Option<String>,
    pub quoted_message_id: Option<String>,
    #[serde(default)]
    pub mentions: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SendMessageResponse {
    pub queued: bool,
    pub queue_key: String,
    pub temp_message_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchMessageRequest {
    pub session_id: String,
    pub chat_jid: String,
    /// `edit` | `react` | `star` | `unstar` | `delete_for_me` | `delete_for_everyone`.
    pub op: String,
    /// New body (when `op = edit`).
    pub body: Option<String>,
    /// Reaction emoji or empty-string to clear (when `op = react`).
    pub emoji: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PatchMessageResponse {
    pub message_id: String,
    pub op: String,
    pub queued: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkReadRequest {
    pub session_id: String,
    pub chat_jid: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MarkReadResponse {
    pub session_id: String,
    pub chat_jid: String,
    pub queued: bool,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StarredQuery {
    pub session_id: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct StarredResponse {
    pub messages: Vec<MessageDto>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchQuery {
    pub session_id: String,
    pub q: String,
    #[serde(default)]
    pub chat_jid: Option<String>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SearchResponse {
    pub messages: Vec<MessageDto>,
}

// ---------- Handlers ----------

async fn list_messages(
    State(state): State<AppState>,
    Query(q): Query<ListMessagesQuery>,
) -> Result<Json<ListMessagesResponse>, AppError> {
    tracing::info!(
        session_id = %q.session_id,
        chat_jid = %q.chat_jid,
        before = ?q.before,
        "messages: list"
    );

    let limit = q.limit.unwrap_or(50).min(200);
    let (rows, next_cursor) =
        crate::db::messages::list(&state.db, &q.session_id, &q.chat_jid, q.before, limit).await?;

    let messages = rows.into_iter().map(into_dto).collect();
    Ok(Json(ListMessagesResponse {
        messages,
        next_cursor,
    }))
}

async fn send_message(
    State(state): State<AppState>,
    Json(body): Json<SendMessageRequest>,
) -> Result<Json<SendMessageResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        chat_jid = %body.chat_jid,
        r#type = %body.r#type,
        "messages: send"
    );

    let temp_message_id = format!("tmp_{}", uuid::Uuid::new_v4());
    let queue_key = format!("sabwa:{}:outbound", body.session_id);

    let payload = serde_json::json!({
        "op": "send",
        "tempMessageId": temp_message_id,
        "chatJid": body.chat_jid,
        "type": body.r#type,
        "body": body.body,
        "mediaUrl": body.media_url,
        "caption": body.caption,
        "quotedMessageId": body.quoted_message_id,
        "mentions": body.mentions,
    });

    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    Ok(Json(SendMessageResponse {
        queued: true,
        queue_key,
        temp_message_id,
    }))
}

async fn patch_message(
    State(state): State<AppState>,
    Path(id): Path<String>,
    Json(body): Json<PatchMessageRequest>,
) -> Result<Json<PatchMessageResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        message_id = %id,
        op = %body.op,
        "messages: patch"
    );

    // Star / unstar are pure DB ops. The rest must go through the WA socket.
    match body.op.as_str() {
        "star" | "unstar" => {
            crate::db::messages::set_starred(
                &state.db,
                &body.session_id,
                &id,
                body.op == "star",
            )
            .await?;
            return Ok(Json(PatchMessageResponse {
                message_id: id,
                op: body.op,
                queued: false,
            }));
        }
        _ => {}
    }

    let queue_key = format!("sabwa:{}:outbound", body.session_id);
    let payload = serde_json::json!({
        "op": body.op,
        "messageId": id,
        "chatJid": body.chat_jid,
        "body": body.body,
        "emoji": body.emoji,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    Ok(Json(PatchMessageResponse {
        message_id: id,
        op: body.op,
        queued: true,
    }))
}

async fn mark_read(
    State(state): State<AppState>,
    Json(body): Json<MarkReadRequest>,
) -> Result<Json<MarkReadResponse>, AppError> {
    tracing::info!(
        session_id = %body.session_id,
        chat_jid = %body.chat_jid,
        "messages: mark-read"
    );

    let queue_key = format!("sabwa:{}:outbound", body.session_id);
    let payload = serde_json::json!({
        "op": "mark_read",
        "chatJid": body.chat_jid,
    });
    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    // Optimistically clear unread counter so the UI flips immediately even
    // before the worker confirms the WA-side read receipt.
    crate::db::chats::clear_unread(&state.db, &body.session_id, &body.chat_jid).await?;

    Ok(Json(MarkReadResponse {
        session_id: body.session_id,
        chat_jid: body.chat_jid,
        queued: true,
    }))
}

async fn list_starred(
    State(state): State<AppState>,
    Query(q): Query<StarredQuery>,
) -> Result<Json<StarredResponse>, AppError> {
    tracing::info!(session_id = %q.session_id, "messages: starred");

    let rows = crate::db::messages::list_starred(&state.db, &q.session_id).await?;
    let messages = rows.into_iter().map(into_dto).collect();
    Ok(Json(StarredResponse { messages }))
}

async fn search_messages(
    State(state): State<AppState>,
    Query(q): Query<SearchQuery>,
) -> Result<Json<SearchResponse>, AppError> {
    tracing::info!(session_id = %q.session_id, q = %q.q, "messages: search");

    let limit = q.limit.unwrap_or(50).min(200);
    let rows = crate::db::messages::search(
        &state.db,
        &q.session_id,
        &q.q,
        q.chat_jid.as_deref(),
        limit,
    )
    .await?;
    let messages = rows.into_iter().map(into_dto).collect();
    Ok(Json(SearchResponse { messages }))
}

// ---------- helpers ----------

fn into_dto(m: crate::db::messages::MessageRow) -> MessageDto {
    MessageDto {
        message_id: m.message_id,
        chat_jid: m.chat_jid,
        from_jid: m.from_jid,
        from_me: m.from_me,
        r#type: m.kind,
        body: m.body,
        media_url: m.media_url,
        media_mime: m.media_mime,
        caption: m.caption,
        quoted_message_id: m.quoted_message_id,
        status: m.status,
        starred: m.starred,
        forwarded: m.forwarded,
        ts: m.ts,
        edited_at: m.edited_at,
        deleted_at: m.deleted_at,
        reactions: m.reactions,
    }
}
