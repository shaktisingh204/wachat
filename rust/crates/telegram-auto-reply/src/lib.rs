//! # telegram-auto-reply
//!
//! Telegram auto-reply rules CRUD. Mount under `/v1/telegram/auto-reply`.

pub mod dto;
pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramAutoReplyState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramAutoReplyState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::upsert))
        .route(
            "/{rule_id}",
            delete(handlers::delete_rule),
        )
        .route("/{rule_id}/toggle", post(handlers::toggle))
}
