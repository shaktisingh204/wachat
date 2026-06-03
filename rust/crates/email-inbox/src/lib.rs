//! # email-inbox
//!
//! Axum router for the SabNode Email Suite inbox surface. Replaces the
//! legacy `email_conversation` plumbing with the new `email_threads` /
//! `email_messages` / `email_assignments` collection trio (see
//! `plan/EMAIL_APP_REBUILD_PLAN.md` §5).
//!
//! ## Mount path
//!
//! Routes are written **relative**. The caller (the `api` crate) nests
//! the result under `/v1/email/inbox`, giving final URLs like
//! `/v1/email/inbox/threads/{id}/messages`.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need only:
//!
//! - an [`EmailInboxState`] bundle (Mongo handle), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. Every Mongo query is scoped by
//! `userId == AuthUser.tenant_id` — there is no anonymous or
//! cross-tenant access.
//!
//! ## Outbound send caveat
//!
//! `POST /threads/{id}/messages` only **persists** the outbound row and
//! updates the thread preview. Actual SMTP / provider dispatch is owned
//! by a future `email-sender` worker fed via BullMQ — the handler emits
//! a `tracing::warn!("send not yet wired")` so the gap is observable
//! until that worker lands.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub mod dto;
pub mod handlers;
pub mod state;

pub use state::EmailInboxState;

/// Build the email-inbox router.
///
/// Routes (mounted relative — caller nests under `/v1/email/inbox`):
///
/// ```text
/// GET    /threads                                  — list_threads (filters + cursor pagination)
/// GET    /threads/{thread_id}                      — get_thread (thread + last N messages)
/// PATCH  /threads/{thread_id}                      — update_thread (status / starred / labels / unread)
/// POST   /threads/bulk                             — bulk_update_threads
///
/// GET    /threads/{thread_id}/messages             — list_messages (paginated)
/// POST   /threads/{thread_id}/messages             — send_reply (persist outbound; SMTP deferred)
///
/// GET    /threads/{thread_id}/assignments          — list_assignments
/// POST   /threads/{thread_id}/assign               — assign_thread
/// DELETE /threads/{thread_id}/assignments/{id}     — release_assignment
/// ```
///
/// `S` is the caller's outer application state. The handlers need an
/// [`EmailInboxState`] bundle and the JWT verifier config; both are
/// pulled via [`FromRef`] so the router does not have to know about a
/// concrete monolithic state struct.
///
/// **Route ordering note:** the literal `bulk` segment is registered
/// before the `/{thread_id}` patterns so axum's matcher prefers the
/// literal over the `{id}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    EmailInboxState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal segments (must precede /{thread_id}) -------------
        .route("/threads/bulk", post(handlers::bulk_update_threads))
        // ---- top-level thread list ------------------------------------
        .route("/threads", get(handlers::list_threads))
        // ---- per-thread endpoints -------------------------------------
        .route(
            "/threads/{thread_id}",
            get(handlers::get_thread).patch(handlers::update_thread),
        )
        .route(
            "/threads/{thread_id}/messages",
            get(handlers::list_messages).post(handlers::send_reply),
        )
        .route(
            "/threads/{thread_id}/assignments",
            get(handlers::list_assignments),
        )
        .route("/threads/{thread_id}/assign", post(handlers::assign_thread))
        .route(
            "/threads/{thread_id}/assignments/{assignment_id}",
            delete(handlers::release_assignment),
        )
}
