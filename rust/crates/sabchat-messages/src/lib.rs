//! # sabchat-messages
//!
//! Phase — axum router for the SabChat messages HTTP surface. Mounted
//! under `/v1/sabchat/messages` by the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/messages", sabchat_messages::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! | HTTP route                              | Handler                |
//! |-----------------------------------------|------------------------|
//! | `POST   /`                              | [`handlers::append`]   |
//! | `GET    /?conversationId=&beforeId=&limit=` | [`handlers::list`] |
//! | `GET    /{id}`                          | [`handlers::get_one`]  |
//! | `PATCH  /{id}`                          | [`handlers::edit`]     |
//! | `DELETE /{id}`                          | [`handlers::soft_delete`] |
//!
//! Each mutating handler also touches two side collections:
//!
//! - `sabchat_conversations` — `last_message_at`, `last_message_preview`,
//!   `unread_count`, and `first_response_at` (first outbound).
//! - `sabchat_audit_log` — `message_sent` / `message_edited` /
//!   `message_deleted` events for the paper trail.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatMessagesState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled via [`FromRef`](axum::extract::FromRef) so this crate
//! stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
mod preview;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabchat_ws::WsHub;

pub use state::SabChatMessagesState;

/// Build the SabChat messages router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/messages`):
///
/// ```text
/// POST   /                          — append
/// GET    /                          — list
/// GET    /{id}                      — get_one
/// PATCH  /{id}                      — edit
/// DELETE /{id}                      — soft_delete
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatMessagesState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatMessagesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
    WsHub: FromRef<S>,
{
    Router::new()
        // ---- collection root ------------------------------------------
        .route("/", post(handlers::append).get(handlers::list))
        // ---- per-message endpoints ------------------------------------
        .route(
            "/{id}",
            get(handlers::get_one)
                .patch(handlers::edit)
                .delete(handlers::soft_delete),
        )
}
