//! # telegram-flows
//!
//! Quick-reply shortcuts (the simple flows building block). Mount under
//! `/v1/telegram/flows`.

pub mod handlers;
pub mod state;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub use state::TelegramFlowsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    TelegramFlowsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::upsert))
        .route("/{reply_id}", delete(handlers::delete_reply))
}
