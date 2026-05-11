//! # telegram-commands
//!
//! Telegram bot command registry, scope-aware command-graph definitions,
//! invocation log and BotAPI push.
//!
//! This crate is the source of truth for *defined* commands: a project
//! can define a single canonical set of commands, scope them, attach
//! arbitrary handler payloads (reply text, media, run-flow, http-call,
//! noop), and push them to one or more bots' BotAPI command lists. The
//! sister `telegram-bots` crate still owns the live BotAPI push; the
//! `push` endpoint here calls Telegram directly using the project-owned
//! bot token (the bots crate's BotAPI client is shared via state).
//!
//! Mount under `/v1/telegram/commands`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use handlers::{log_invocation, match_command};
pub use state::TelegramCommandsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramCommandsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route("/push", post(handlers::push))
        .route("/pull", post(handlers::pull))
        .route("/match", post(handlers::match_handler))
        .route("/log", post(handlers::log_handler))
        .route("/analytics", get(handlers::analytics))
        .route("/import", post(handlers::import))
        .route("/export", get(handlers::export_csv))
        .route("/{id}/duplicate", post(handlers::duplicate))
        .route("/{id}/runs", get(handlers::runs))
        .route(
            "/{id}",
            get(handlers::detail)
                .put(handlers::update)
                .delete(handlers::delete_one),
        )
}
