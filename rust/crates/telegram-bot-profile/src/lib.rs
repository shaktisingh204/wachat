//! # telegram-bot-profile
//!
//! Update bot display name / description / short description /
//! mini-app URL, and the chat menu button. Mount under
//! `/v1/telegram/bot-profile`.

pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::post};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramBotProfileState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramBotProfileState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/{bot_id}", post(handlers::update_profile))
        .route("/{bot_id}/menu-button", post(handlers::set_menu_button))
}
