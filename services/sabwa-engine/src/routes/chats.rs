//! `/chats` — cached chat list mirroring Baileys store.
//!
//! Implements the server actions from SABWA_PLAN.md §13: `listChats`,
//! `pinChat`, `muteChat`, `archiveChat`, `deleteChat` (plus a single-chat
//! read used by detail panes).

use axum::{
    extract::{Path, Query, State},
    routing::get,
    Json, Router,
};
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::state::AppState;

/// Build the `/chats` sub-router.
pub fn router() -> Router<AppState> {
    Router::new()
        .route("/", get(list_chats))
        .route(
            "/:jid",
            get(get_chat).patch(update_chat).delete(delete_chat),
        )
}

// ---------- DTOs ----------

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ListChatsQuery {
    pub session_id: String,
    /// `all` | `individual` | `group`. Defaults to `all`.
    #[serde(default)]
    pub filter: Option<String>,
    #[serde(default)]
    pub unread: Option<bool>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatSummary {
    pub jid: String,
    pub r#type: String,
    pub name: Option<String>,
    pub profile_pic_url: Option<String>,
    pub unread_count: u32,
    pub pinned: bool,
    pub archived: bool,
    pub muted: bool,
    pub last_message_ts: Option<chrono::DateTime<chrono::Utc>>,
    pub last_message_body: Option<String>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ListChatsResponse {
    pub chats: Vec<ChatSummary>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ChatJidQuery {
    pub session_id: String,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateChatRequest {
    pub session_id: String,
    pub pinned: Option<bool>,
    pub muted: Option<bool>,
    pub mute_end_at: Option<chrono::DateTime<chrono::Utc>>,
    pub archived: Option<bool>,
    pub labels: Option<Vec<String>>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdatedChatResponse {
    pub jid: String,
    pub updated: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DeletedChatResponse {
    pub jid: String,
    pub deleted: bool,
}

// ---------- Handlers ----------

async fn list_chats(
    State(state): State<AppState>,
    Query(q): Query<ListChatsQuery>,
) -> Result<Json<ListChatsResponse>, AppError> {
    tracing::info!(
        session_id = %q.session_id,
        filter = ?q.filter,
        unread = ?q.unread,
        "chats: list"
    );

    let rows = crate::db::chats::list(
        &state.db,
        &q.session_id,
        q.filter.as_deref(),
        q.unread.unwrap_or(false),
    )
    .await?;

    let chats = rows
        .into_iter()
        .map(|c| ChatSummary {
            jid: c.jid,
            r#type: c.chat_type,
            name: c.name,
            profile_pic_url: c.profile_pic_url,
            unread_count: c.unread_count,
            pinned: c.pinned,
            archived: c.archived,
            muted: c.muted,
            last_message_ts: c.last_message_ts,
            last_message_body: c.last_message_body,
        })
        .collect();

    Ok(Json(ListChatsResponse { chats }))
}

async fn get_chat(
    State(state): State<AppState>,
    Path(jid): Path<String>,
    Query(q): Query<ChatJidQuery>,
) -> Result<Json<ChatSummary>, AppError> {
    tracing::info!(session_id = %q.session_id, jid = %jid, "chats: get");

    let c = crate::db::chats::get(&state.db, &q.session_id, &jid).await?;
    Ok(Json(ChatSummary {
        jid: c.jid,
        r#type: c.chat_type,
        name: c.name,
        profile_pic_url: c.profile_pic_url,
        unread_count: c.unread_count,
        pinned: c.pinned,
        archived: c.archived,
        muted: c.muted,
        last_message_ts: c.last_message_ts,
        last_message_body: c.last_message_body,
    }))
}

async fn update_chat(
    State(state): State<AppState>,
    Path(jid): Path<String>,
    Json(body): Json<UpdateChatRequest>,
) -> Result<Json<UpdatedChatResponse>, AppError> {
    tracing::info!(session_id = %body.session_id, jid = %jid, "chats: update");

    crate::db::chats::update(
        &state.db,
        &body.session_id,
        &jid,
        body.pinned,
        body.muted,
        body.mute_end_at,
        body.archived,
        body.labels.as_deref(),
    )
    .await?;

    Ok(Json(UpdatedChatResponse {
        jid,
        updated: true,
    }))
}

async fn delete_chat(
    State(state): State<AppState>,
    Path(jid): Path<String>,
    Query(q): Query<ChatJidQuery>,
) -> Result<Json<DeletedChatResponse>, AppError> {
    tracing::info!(session_id = %q.session_id, jid = %jid, "chats: delete");

    crate::db::chats::delete(&state.db, &q.session_id, &jid).await?;
    // History wipe also removes message documents — repo layer fans this out.
    crate::db::messages::delete_for_chat(&state.db, &q.session_id, &jid).await?;

    Ok(Json(DeletedChatResponse {
        jid,
        deleted: true,
    }))
}
