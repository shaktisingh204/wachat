//! # telegram-stickers
//!
//! Track Telegram sticker sets owned by a bot. List/create/delete the
//! local metadata; uploads to Telegram itself happen client-side via
//! `t.me/stickers`. Mount under `/v1/telegram/stickers`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramStickersState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramStickersState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route("/{set_id}", delete(handlers::delete_set))
}
