//! # telegram-analytics
//!
//! Read-only Mongo aggregations across the Telegram crates:
//!
//! - `overview`  — workspace KPIs (bots, messages, broadcasts, payments,
//!   commands, auto-reply, contacts, chats).
//! - `messages-timeseries`, `broadcasts-timeseries` — time-bucketed series
//!   for charts (hour / day / week granularity).
//! - `top-contacts`, `top-commands` — leaderboards.
//! - `funnel` — contacted → replied → completed flow → paid.
//! - `export.csv` — CSV stream for offline analysis.
//!
//! All endpoints are mounted under `/v1/telegram/analytics`, require an
//! authenticated `AuthUser`, and are scoped by a verified `projectId`
//! (the project's `userId` must match the auth subject).

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
        .route("/messages-timeseries", get(handlers::messages_timeseries))
        .route(
            "/broadcasts-timeseries",
            get(handlers::broadcasts_timeseries),
        )
        .route("/top-contacts", get(handlers::top_contacts))
        .route("/top-commands", get(handlers::top_commands))
        .route("/funnel", get(handlers::funnel))
        .route("/export.csv", get(handlers::export_csv))
}
