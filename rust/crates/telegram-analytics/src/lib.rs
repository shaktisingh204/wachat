//! # telegram-analytics
//!
//! Read-only Mongo aggregations: workspace-level overview counters, and
//! per-bot timeseries / top-chats. Mount under
//! `/v1/telegram/analytics`.

pub mod handlers;
pub mod state;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramAnalyticsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramAnalyticsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/overview", get(handlers::overview))
        .route("/bots/{bot_id}", get(handlers::bot_analytics))
}
