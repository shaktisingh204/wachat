//! # sabchat-inboxes
//!
//! Phase — axum router for the SabChat **inbox registry**. One inbox is
//! one channel binding (a website widget, a WhatsApp Cloud number, an
//! Instagram page, a shared email address, …). Tenancy + RBAC scope
//! down to the inbox level; routing rules and business hours live on
//! the inbox document.
//!
//! Mounted under `/v1/sabchat/inboxes` from the orchestrating `api`
//! crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/inboxes", sabchat_inboxes::router::<AppState>())
//! ```
//!
//! ## Routes
//!
//! | Method | Path                          | Handler          |
//! |--------|-------------------------------|------------------|
//! | POST   | `/`                           | `create_inbox`   |
//! | GET    | `/?channelType=&enabled=`     | `list_inboxes`   |
//! | GET    | `/{id}`                       | `get_inbox`      |
//! | PATCH  | `/{id}`                       | `update_inbox`   |
//! | POST   | `/{id}/agents`                | `add_agent`      |
//! | DELETE | `/{id}/agents/{agentId}`      | `remove_agent`   |
//! | DELETE | `/{id}`                       | `delete_inbox`   |
//!
//! ## Tenancy
//!
//! Every read and write is scoped by `tenant_id == auth.tenant_id`. The
//! tenant id rides on the JWT claims as a hex string and is parsed to
//! an `ObjectId` per-request; a malformed claim yields
//! [`ApiError::Unauthorized`](sabnode_common::ApiError::Unauthorized) so
//! tampered or stale tokens can never leak into other tenants' inboxes.
//!
//! ## Soft delete
//!
//! `DELETE /{id}` does **not** drop the document. It flips
//! `enabled=false` and prepends `"(deleted) "` to the inbox `name`. The
//! conversation + message collections carry an `inboxId` FK; hard
//! deletes would orphan that history.
//!
//! ## Audit log
//!
//! `create_inbox`, `update_inbox`, and `delete_inbox` append an
//! immutable event to `sabchat_audit_log` (the
//! [`SabChatAuditEvent`](sabchat_types::SabChatAuditEvent) collection).
//! Failures to write the audit row are logged but **do not** fail the
//! main request — auditing is best-effort observability, not a
//! correctness gate.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The
//! handlers need:
//!
//! - a [`SabChatInboxesState`] bundle (a Mongo handle), and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! Both are pulled out via [`FromRef`](axum::extract::FromRef) so this
//! crate stays decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatInboxesState;

/// Build the SabChat inboxes router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/inboxes`):
///
/// ```text
/// POST   /                          — create_inbox
/// GET    /                          — list_inboxes
/// GET    /{id}                      — get_inbox
/// PATCH  /{id}                      — update_inbox
/// POST   /{id}/agents               — add_agent
/// DELETE /{id}/agents/{agentId}     — remove_agent
/// DELETE /{id}                      — delete_inbox
/// ```
///
/// `S` is the caller's outer application state. The handlers need a
/// [`SabChatInboxesState`] bundle and the JWT verifier config; both
/// are pulled via [`FromRef`] so the router does not have to know
/// about a concrete monolithic state struct.
///
/// **Route ordering note:** the deeper `/{id}/agents/{agentId}` segment
/// is registered before the shallower `/{id}/agents` so the matcher
/// has both to disambiguate by method.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatInboxesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- collection root ------------------------------------------
        .route(
            "/",
            post(handlers::create_inbox).get(handlers::list_inboxes),
        )
        // ---- per-inbox endpoints --------------------------------------
        .route(
            "/{id}",
            get(handlers::get_inbox)
                .patch(handlers::update_inbox)
                .delete(handlers::delete_inbox),
        )
        // ---- agent management -----------------------------------------
        .route("/{id}/agents", post(handlers::add_agent))
        .route("/{id}/agents/{agent_id}", delete(handlers::remove_agent))
}
