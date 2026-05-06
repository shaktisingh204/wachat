//! # telegram-mini-apps
//!
//! Read-only registry of bots that have a Mini App URL configured.
//! Mount under `/v1/telegram/mini-apps`. URL editing happens via
//! `telegram-bot-profile`.

pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramMiniAppsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramMiniAppsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new().route("/", get(handlers::list))
}
