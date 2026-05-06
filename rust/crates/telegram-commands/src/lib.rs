//! # telegram-commands
//!
//! Get/set Telegram bot slash commands. Mount under
//! `/v1/telegram/commands`.

pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramCommandsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramCommandsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route(
        "/{bot_id}",
        get(handlers::get_commands).post(handlers::set_commands),
    )
}
