//! # telegram-channels
//!
//! List Telegram channels linked to a bot. Mount under
//! `/v1/telegram/channels`.

pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramChannelsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramChannelsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/", get(handlers::list))
}
