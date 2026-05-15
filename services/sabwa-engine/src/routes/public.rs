//! `/v1/public/*` — minimal, API-key-gated surface for external integrators.
//!
//! Every handler here runs *after* [`crate::auth::require_api_key`], so it
//! can rely on `Extension<ApiKeyProject>` (and optionally `ApiKeyScopes`)
//! being present in the request. The project id pinned by the key is the
//! only source of truth for tenancy — callers never get to pick a different
//! `projectId` than the one their key was minted for.
//!
//! The four endpoints below are deliberate, narrow re-exposures of the
//! internal `/v1/messages`, `/v1/sessions`, `/v1/chats`, `/v1/scheduled`
//! paths. Anything that mutates billing, sessions lifecycle, or admin state
//! stays off this surface on purpose.

use axum::{
    extract::{Path, Query, State},
    routing::{get, post},
    Extension, Json, Router,
};
use bson::oid::ObjectId;
use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use serde_json::Value as JsonValue;

use crate::auth::ApiKeyProject;
use crate::error::AppError;
use crate::state::AppState;

/// Build the `/v1/public/*` sub-router. Auth middleware is attached by the
/// caller in [`crate::routes::public_router`].
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/messages", post(send_message))
        .route("/sessions", get(list_sessions))
        .route("/chats", get(list_chats))
        .route("/chats/:jid/messages", get(list_chat_messages))
        .route("/scheduled", post(create_scheduled))
}

// ===========================================================================
// POST /v1/public/messages
// ===========================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSendMessageRequest {
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
pub struct PublicSendMessageResponse {
    pub queued: bool,
    pub queue_key: String,
    pub temp_message_id: String,
}

async fn send_message(
    State(state): State<AppState>,
    Extension(ApiKeyProject(project_id)): Extension<ApiKeyProject>,
    Json(body): Json<PublicSendMessageRequest>,
) -> Result<Json<PublicSendMessageResponse>, AppError> {
    // Confirm the session belongs to the key's project before enqueueing.
    let session = crate::db::sessions::get(&state.db, &body.session_id).await?;
    let session_project = ObjectId::parse_str(&session.project_id)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("session.projectId malformed")))?;
    if session_project != project_id {
        return Err(AppError::Unauthorized);
    }

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
        "source": "public_api",
    });

    crate::db::misc::redis_lpush(&state.redis, &queue_key, &payload.to_string()).await?;

    Ok(Json(PublicSendMessageResponse {
        queued: true,
        queue_key,
        temp_message_id,
    }))
}

// ===========================================================================
// GET /v1/public/sessions
// ===========================================================================

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicSessionSummary {
    pub session_id: String,
    pub phone_e164: Option<String>,
    pub status: String,
    pub push_name: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicListSessionsResponse {
    pub sessions: Vec<PublicSessionSummary>,
}

async fn list_sessions(
    State(state): State<AppState>,
    Extension(ApiKeyProject(project_id)): Extension<ApiKeyProject>,
) -> Result<Json<PublicListSessionsResponse>, AppError> {
    let docs =
        crate::db::sessions::list_by_project(&state.db, &project_id.to_hex()).await?;
    let sessions = docs
        .into_iter()
        .map(|s| PublicSessionSummary {
            session_id: s.id,
            phone_e164: s.phone_e164,
            status: s.status,
            push_name: s.push_name,
        })
        .collect();
    Ok(Json(PublicListSessionsResponse { sessions }))
}

// ===========================================================================
// GET /v1/public/chats
// ===========================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicListChatsQuery {
    pub session_id: String,
    #[serde(default)]
    pub filter: Option<String>,
    #[serde(default)]
    pub unread: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicChatSummary {
    pub jid: String,
    pub r#type: String,
    pub name: Option<String>,
    pub unread_count: u32,
    pub last_message_ts: Option<DateTime<Utc>>,
    pub last_message_body: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicListChatsResponse {
    pub chats: Vec<PublicChatSummary>,
}

async fn list_chats(
    State(state): State<AppState>,
    Extension(ApiKeyProject(project_id)): Extension<ApiKeyProject>,
    Query(q): Query<PublicListChatsQuery>,
) -> Result<Json<PublicListChatsResponse>, AppError> {
    enforce_session_project(&state, &q.session_id, &project_id).await?;

    let rows = crate::db::chats::list(
        &state.db,
        &q.session_id,
        q.filter.as_deref(),
        q.unread.unwrap_or(false),
    )
    .await?;

    let chats = rows
        .into_iter()
        .map(|c| PublicChatSummary {
            jid: c.jid,
            r#type: c.chat_type,
            name: c.name,
            unread_count: c.unread_count,
            last_message_ts: c.last_message_ts,
            last_message_body: c.last_message_body,
        })
        .collect();

    Ok(Json(PublicListChatsResponse { chats }))
}

// ===========================================================================
// GET /v1/public/chats/:jid/messages
// ===========================================================================

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicListChatMessagesQuery {
    pub session_id: String,
    #[serde(default)]
    pub before: Option<DateTime<Utc>>,
    #[serde(default)]
    pub limit: Option<u32>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicMessageDto {
    pub message_id: String,
    pub chat_jid: String,
    pub from_jid: String,
    pub from_me: bool,
    pub r#type: String,
    pub body: Option<String>,
    pub media_url: Option<String>,
    pub status: String,
    pub ts: DateTime<Utc>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicListChatMessagesResponse {
    pub messages: Vec<PublicMessageDto>,
    pub next_cursor: Option<DateTime<Utc>>,
}

async fn list_chat_messages(
    State(state): State<AppState>,
    Extension(ApiKeyProject(project_id)): Extension<ApiKeyProject>,
    Path(jid): Path<String>,
    Query(q): Query<PublicListChatMessagesQuery>,
) -> Result<Json<PublicListChatMessagesResponse>, AppError> {
    enforce_session_project(&state, &q.session_id, &project_id).await?;

    let limit = q.limit.unwrap_or(50).min(200);
    let (rows, next_cursor) =
        crate::db::messages::list(&state.db, &q.session_id, &jid, q.before, limit).await?;

    let messages = rows
        .into_iter()
        .map(|m| PublicMessageDto {
            message_id: m.message_id,
            chat_jid: m.chat_jid,
            from_jid: m.from_jid,
            from_me: m.from_me,
            r#type: m.kind,
            body: m.body,
            media_url: m.media_url,
            status: m.status,
            ts: m.ts,
        })
        .collect();

    Ok(Json(PublicListChatMessagesResponse {
        messages,
        next_cursor,
    }))
}

// ===========================================================================
// POST /v1/public/scheduled
// ===========================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicScheduledTarget {
    pub jid: String,
    /// `individual` | `group` | `broadcast`.
    pub r#type: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCreateScheduledRequest {
    pub session_id: String,
    /// `one_off` | `recurring`.
    pub kind: String,
    pub scheduled_for: DateTime<Utc>,
    pub cron: Option<String>,
    pub timezone: Option<String>,
    pub targets: Vec<PublicScheduledTarget>,
    pub payload: JsonValue,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicCreateScheduledResponse {
    pub scheduled_id: String,
    pub status: String,
}

async fn create_scheduled(
    State(state): State<AppState>,
    Extension(ApiKeyProject(project_id)): Extension<ApiKeyProject>,
    Json(body): Json<PublicCreateScheduledRequest>,
) -> Result<Json<PublicCreateScheduledResponse>, AppError> {
    enforce_session_project(&state, &body.session_id, &project_id).await?;

    let scheduled_id = format!("sch_{}", uuid::Uuid::new_v4());
    let project_hex = project_id.to_hex();

    let targets_json: Vec<JsonValue> = body
        .targets
        .iter()
        .map(|t| serde_json::json!({ "jid": t.jid, "type": t.r#type }))
        .collect();

    crate::db::scheduled::insert(
        &state.db,
        &scheduled_id,
        &project_hex,
        &body.session_id,
        &body.kind,
        body.scheduled_for,
        body.cron.as_deref(),
        body.timezone.as_deref(),
        &targets_json,
        &body.payload,
    )
    .await?;

    let job = crate::scheduler::queue::ScheduledJob {
        id: scheduled_id.clone(),
        session_id: body.session_id.clone(),
        project_id: project_hex,
        scheduled_for_ts: body.scheduled_for.timestamp(),
        kind: crate::scheduler::queue::ScheduledJobKind::SendMessage,
        payload: body.payload.clone(),
    };
    let _ = crate::scheduler::queue::enqueue(&state.redis, job).await;

    Ok(Json(PublicCreateScheduledResponse {
        scheduled_id,
        status: "pending".into(),
    }))
}

// ===========================================================================
// Helpers
// ===========================================================================

/// Verify that `session_id` belongs to `project_id` — returns 401 otherwise so
/// integrators can't enumerate sessions outside their tenant.
async fn enforce_session_project(
    state: &AppState,
    session_id: &str,
    project_id: &ObjectId,
) -> Result<(), AppError> {
    let session = crate::db::sessions::get(&state.db, session_id).await?;
    let session_project = ObjectId::parse_str(&session.project_id)
        .map_err(|_| AppError::Internal(anyhow::anyhow!("session.projectId malformed")))?;
    if session_project != *project_id {
        return Err(AppError::Unauthorized);
    }
    Ok(())
}
