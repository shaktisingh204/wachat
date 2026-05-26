//! # sabchat-conversations
//!
//! Phase — axum router that owns the lifecycle of a SabChat
//! conversation. Mounted under `/v1/sabchat/conversations` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/conversations", sabchat_conversations::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! A SabChat conversation is one running thread between one inbox and
//! one contact (see [`sabchat_types::SabChatConversation`]). This crate
//! handles creation, paginated listing, lookup, and the small graph of
//! state transitions agents drive from the inbox UI: status, priority,
//! assignee, labels, snooze / resolve / reopen.
//!
//! Messages themselves are owned by the sibling `sabchat-messages`
//! crate; we only touch the parent conversation document plus the
//! assignment history and audit log.
//!
//! | Route                                  | Handler                       |
//! |----------------------------------------|-------------------------------|
//! | `POST   /`                             | `create_conversation`         |
//! | `GET    /`                             | `list_conversations`          |
//! | `GET    /{id}`                         | `get_conversation`            |
//! | `PATCH  /{id}/status`                  | `update_status`               |
//! | `PATCH  /{id}/priority`                | `update_priority`             |
//! | `PATCH  /{id}/assignee`                | `update_assignee`             |
//! | `POST   /{id}/labels`                  | `add_label`                   |
//! | `DELETE /{id}/labels/{label}`          | `remove_label`                |
//! | `POST   /{id}/snooze`                  | `snooze_conversation`         |
//! | `POST   /{id}/resolve`                 | `resolve_conversation`        |
//! | `POST   /{id}/reopen`                  | `reopen_conversation`         |
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. Every Mongo query is filtered by
//! `tenant_id == ObjectId::parse_str(&auth.tenant_id)`; an unparseable
//! subject yields [`ApiError::Unauthorized`](sabnode_common::ApiError).
//! Cross-tenant reads / writes therefore manifest as plain `404`s,
//! since the filter never matches a foreign-tenant document.
//!
//! ## Collections
//!
//! - `sabchat_conversations` — primary documents (Mongo collection that
//!   round-trips [`sabchat_types::SabChatConversation`]).
//! - `sabchat_assignments` — append-only assignment history
//!   ([`sabchat_types::SabChatAssignment`]).
//! - `sabchat_audit_log` — append-only audit events; we write raw
//!   `bson::doc!` documents shaped like
//!   [`sabchat_types::SabChatAuditEvent`].
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatConversationsState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub(crate) mod audit;
pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatConversationsState;

/// Build the SabChat conversations router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/conversations`):
///
/// ```text
/// POST   /                          — create_conversation
/// GET    /                          — list_conversations
/// GET    /{id}                      — get_conversation
/// PATCH  /{id}/status               — update_status
/// PATCH  /{id}/priority             — update_priority
/// PATCH  /{id}/assignee             — update_assignee
/// POST   /{id}/labels               — add_label
/// DELETE /{id}/labels/{label}       — remove_label
/// POST   /{id}/snooze               — snooze_conversation
/// POST   /{id}/resolve              — resolve_conversation
/// POST   /{id}/reopen               — reopen_conversation
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatConversationsState`] bundle and the JWT verifier config;
/// both are pulled via [`FromRef`] so the router does not have to know
/// about a concrete monolithic state struct.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatConversationsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- collection root ------------------------------------------
        .route(
            "/",
            post(handlers::create_conversation).get(handlers::list_conversations),
        )
        // ---- per-conversation read ------------------------------------
        .route("/{id}", get(handlers::get_conversation))
        // ---- mutating transitions -------------------------------------
        .route("/{id}/status", patch(handlers::update_status))
        .route("/{id}/priority", patch(handlers::update_priority))
        .route("/{id}/assignee", patch(handlers::update_assignee))
        // ---- labels (literal `/labels/{label}` before bare `/labels`)
        .route("/{id}/labels/{label}", delete(handlers::remove_label))
        .route("/{id}/labels", post(handlers::add_label))
        // ---- lifecycle shortcuts --------------------------------------
        .route("/{id}/snooze", post(handlers::snooze_conversation))
        .route("/{id}/resolve", post(handlers::resolve_conversation))
        .route("/{id}/reopen", post(handlers::reopen_conversation))
}
