//! # telegram-stories
//!
//! Schedule channel posts (the bot-side equivalent of "stories"). Mount
//! under `/v1/telegram/stories`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramStoriesState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramStoriesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::schedule))
        .route("/{post_id}", delete(handlers::cancel))
}
