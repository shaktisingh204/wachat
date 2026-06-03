//! # telegram-chats
//!
//! Telegram chat inbox for the SabNode BFF. Implements the full chat
//! surface: list / paginated history / send (text + media) / edit /
//! delete / forward / copy / pin / unpin / typing / metadata refresh /
//! cross-chat search / SSE live stream.
//!
//! ## Routes (all nested under `/v1/telegram/chats` by the `api` crate)
//!
//! | Method | Path                                                           |
//! |--------|----------------------------------------------------------------|
//! | GET    | `/`                                                            |
//! | GET    | `/search`                                                      |
//! | GET    | `/c/{chat_id}`                                                 |
//! | POST   | `/c/{chat_id}/refresh`                                         |
//! | GET    | `/c/{chat_id}/member/{user_id}`                                |
//! | GET    | `/c/{chat_id}/messages`                                        |
//! | POST   | `/c/{chat_id}/messages`                                        |
//! | PATCH  | `/c/{chat_id}/messages/{message_id}`                           |
//! | DELETE | `/c/{chat_id}/messages/{message_id}`                           |
//! | POST   | `/c/{chat_id}/messages/{message_id}/forward`                   |
//! | POST   | `/c/{chat_id}/messages/{message_id}/copy`                      |
//! | POST   | `/c/{chat_id}/messages/{message_id}/pin`                       |
//! | DELETE | `/c/{chat_id}/messages/{message_id}/pin`                       |
//! | POST   | `/c/{chat_id}/action`                                          |
//! | GET    | `/c/{chat_id}/stream`                                          |
//! | GET    | `/{bot_id}/{chat_tg_id}/messages`     (legacy)                 |
//! | POST   | `/{bot_id}/{chat_tg_id}/messages`     (legacy)                 |
//! | POST   | `/{bot_id}/{chat_tg_id}/read`         (legacy)                 |
//!
//! The `/c/…` prefix disambiguates the chat-doc-id-keyed routes from the
//! legacy `/{bot_id}/{chat_tg_id}/…` routes, both of which would
//! otherwise share `/{:string}/…` shape and clash on axum's matcher.

pub mod bot_client;
pub mod dto;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramChatsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramChatsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_chats))
        .route("/search", get(handlers::search_messages))
        // Legacy: bot-scoped messages / mark-read live at /{bot_id}/{chat_tg_id}/…
        .route(
            "/{bot_id}/{chat_tg_id}/messages",
            get(handlers::list_messages_legacy).post(handlers::send_text_legacy),
        )
        .route("/{bot_id}/{chat_tg_id}/read", post(handlers::mark_read))
        // New chat-scoped surface — chat id is a hex ObjectId.
        .route("/c/{chat_id}", get(handlers::get_chat))
        .route("/c/{chat_id}/refresh", post(handlers::refresh_chat))
        .route(
            "/c/{chat_id}/member/{user_id}",
            get(handlers::get_chat_member),
        )
        .route(
            "/c/{chat_id}/messages",
            get(handlers::list_messages).post(handlers::send_message),
        )
        .route(
            "/c/{chat_id}/messages/{message_id}",
            patch(handlers::edit_message).delete(handlers::delete_message),
        )
        .route(
            "/c/{chat_id}/messages/{message_id}/forward",
            post(handlers::forward_message),
        )
        .route(
            "/c/{chat_id}/messages/{message_id}/copy",
            post(handlers::copy_message),
        )
        .route(
            "/c/{chat_id}/messages/{message_id}/pin",
            post(handlers::pin_message).delete(handlers::unpin_message),
        )
        .route("/c/{chat_id}/action", post(handlers::chat_action))
        .route("/c/{chat_id}/stream", get(handlers::message_stream))
}
