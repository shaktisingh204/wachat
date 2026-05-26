//! # sabchat-macros
//!
//! Phase — axum router for **Macros 2.0**: multi-step, conditional,
//! variable-templated canned actions stored per-tenant and executed
//! against a live conversation. Mounted under `/v1/sabchat/macros` from
//! the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/macros", sabchat_macros::router::<AppState>())
//! ```
//!
//! ## Scope
//!
//! A SabChat macro is a tenant-scoped ordered list of steps. Each step
//! is one of:
//!
//! - `send_message { content, private? }` — append a message (visible
//!   or as a private note) to the conversation.
//! - `add_label { label }` / `remove_label { label }` — mutate
//!   `sabchat_conversations.labels`.
//! - `set_status { status }` — set `sabchat_conversations.status`.
//! - `set_priority { priority }` — set `sabchat_conversations.priority`.
//! - `set_assignee { assigneeId }` — set / clear
//!   `sabchat_conversations.assigneeId`.
//! - `wait { seconds }` — best-effort sleep (NOT durable; the request
//!   blocks server-side for the requested number of seconds).
//! - `snooze { untilIso }` — set `status = snoozed`, `snoozeUntil = …`.
//! - `resolve` — short-hand for `set_status { status: resolved }` with
//!   the `resolvedAt` stamp.
//!
//! Send-message steps support `{{var}}` interpolation against
//! `vars + conversation.customAttrs`. See [`template::interpolate`].
//!
//! | Route                  | Handler            |
//! |------------------------|--------------------|
//! | `POST   /`             | `create_macro`     |
//! | `GET    /`             | `list_macros`      |
//! | `GET    /{id}`         | `get_macro`        |
//! | `PATCH  /{id}`         | `update_macro`     |
//! | `DELETE /{id}`         | `delete_macro`     |
//! | `POST   /{id}/run`     | `run_macro`        |
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. Every Mongo query is filtered by
//! `tenantId == ObjectId::parse_str(&auth.tenant_id)`; an unparseable
//! subject yields [`ApiError::Unauthorized`](sabnode_common::ApiError).
//! Cross-tenant reads / writes therefore manifest as plain `404`s.
//!
//! ## Collections (direct writes — no sister-crate imports)
//!
//! - `sabchat_macros` — macro definitions (this crate owns it).
//! - `sabchat_conversations` — touched by run-time steps.
//! - `sabchat_messages` — touched by `send_message` steps.
//! - `sabchat_audit_log` — `message_sent` events for any sent step.
//!
//! Per the slice contract we do **not** import `sabchat-conversations`
//! or `sabchat-messages`; the `run` path inlines the few Mongo writes it
//! needs.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatMacrosState`] bundle (just a Mongo handle today), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub(crate) mod run;
pub mod state;
pub(crate) mod template;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatMacrosState;

/// Build the SabChat macros router.
///
/// Routes (mounted relative — caller nests under `/v1/sabchat/macros`):
///
/// ```text
/// POST   /                    — create_macro
/// GET    /                    — list_macros
/// GET    /{id}                — get_macro
/// PATCH  /{id}                — update_macro
/// DELETE /{id}                — delete_macro
/// POST   /{id}/run            — run_macro
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatMacrosState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** `/{id}/run` is registered before `/{id}`
/// so axum prefers the more specific path.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatMacrosState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- collection root ------------------------------------------
        .route("/", post(handlers::create_macro).get(handlers::list_macros))
        // ---- run (specific path before bare `/{id}`) ------------------
        .route("/{id}/run", post(handlers::run_macro))
        // ---- per-macro CRUD ------------------------------------------
        .route(
            "/{id}",
            get(handlers::get_macro)
                .patch(handlers::update_macro)
                .delete(handlers::delete_macro),
        )
}
