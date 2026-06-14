//! # sabchat-ai-actions
//!
//! Axum router that owns the **action-taking AI** HTTP surface for SabChat.
//! Mounted under `/v1/sabchat/ai/actions` from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/ai/actions", sabchat_ai_actions::router::<AppState>())
//! ```
//!
//! ## Model
//!
//! A **connector** is a tool definition the resolve-bot / copilot can invoke
//! to *take action* (look up an order, issue a refund …). v1 ships the
//! `http_webhook` kind: invoking it makes a real outbound HTTP call to the
//! tenant-configured endpoint with the supplied input as the body, and records
//! the result on `sabchat_ai_action_runs`.
//!
//! Auto-selection (the bot deciding *which* connector to call mid-conversation)
//! is the integration follow-up — this crate provides the registry + executor +
//! audit that the bot calls.
//!
//! ## Routes
//!
//! | Method  | Path                        | Handler             |
//! |---------|-----------------------------|---------------------|
//! | `POST`  | `/connectors`               | `create_connector`  |
//! | `GET`   | `/connectors`               | `list_connectors`   |
//! | `PATCH` | `/connectors/{id}`          | `update_connector`  |
//! | `DELETE`| `/connectors/{id}`          | `delete_connector`  |
//! | `POST`  | `/connectors/{id}/invoke`   | `invoke_connector`  |
//! | `GET`   | `/runs`                     | `list_runs` (audit) |
//!
//! Every endpoint requires [`AuthUser`](sabnode_auth::AuthUser) and filters
//! all I/O on the JWT tenant claim.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatAiActionsState;

/// Build the sabchat ai-actions router (mounted relative under
/// `/v1/sabchat/ai/actions`).
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatAiActionsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/runs", get(handlers::list_runs))
        .route(
            "/connectors",
            post(handlers::create_connector).get(handlers::list_connectors),
        )
        .route(
            "/connectors/{id}",
            axum::routing::patch(handlers::update_connector).delete(handlers::delete_connector),
        )
        .route("/connectors/{id}/invoke", post(handlers::invoke_connector))
}
