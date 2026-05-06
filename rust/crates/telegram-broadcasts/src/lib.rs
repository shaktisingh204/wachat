//! # telegram-broadcasts
//!
//! Telegram broadcast manager. Mount under `/v1/telegram/broadcasts`.

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

pub use state::TelegramBroadcastsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramBroadcastsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route("/{broadcast_id}/send", post(handlers::send_now))
}
