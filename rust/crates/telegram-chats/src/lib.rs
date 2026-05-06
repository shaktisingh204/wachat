//! # telegram-chats
//!
//! Telegram chat inbox for the SabNode BFF. Ports the *chats* and
//! *send-text* slices of `src/app/actions/telegram.actions.ts` into
//! Rust.
//!
//! | TS export                  | Route                                                        |
//! |----------------------------|--------------------------------------------------------------|
//! | `listTelegramChats`        | `GET    /v1/telegram/chats?botId={…}&q={…}&limit={…}`        |
//! | `listTelegramMessages`     | `GET    /v1/telegram/chats/{bot_id}/{chat_id}/messages?limit={…}` |
//! | `sendTelegramTextMessage`  | `POST   /v1/telegram/chats/{bot_id}/{chat_id}/messages`      |
//! | `markTelegramChatRead`     | `POST   /v1/telegram/chats/{bot_id}/{chat_id}/read`          |
//!
//! Mount under `/v1/telegram/chats` from the `api` crate.
//!
//! Reuses the [`telegram_bots::bot_api::BotApiClient`] for outbound
//! `sendMessage` calls, so we do not duplicate the HTTP wrapper.

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
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
        .route(
            "/{bot_id}/{chat_id}/messages",
            get(handlers::list_messages).post(handlers::send_text),
        )
        .route(
            "/{bot_id}/{chat_id}/read",
            post(handlers::mark_read),
        )
}
