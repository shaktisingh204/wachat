//! # sabchat-cobrowse
//!
//! Phase — axum routers for the SabChat **co-browse** signalling layer.
//! There are **two** mount points; the orchestrating `api` crate nests
//! each under its own prefix:
//!
//! ```ignore
//! .nest("/v1/sabchat/cobrowse",        sabchat_cobrowse::router::<AppState>())
//! .nest("/v1/sabchat/cobrowse-public", sabchat_cobrowse::public_router::<AppState>())
//! ```
//!
//! ## Why two routers
//!
//! Co-browse signalling has an inherent two-party trust split:
//!
//! - The **agent** calls from the SabChat inbox UI and is authenticated
//!   by the usual SabNode JWT — the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor gives us
//!   `(user_id, tenant_id)` to scope every read / write.
//! - The **visitor** calls from the public JS widget loaded on a
//!   third-party site. The widget can't present a SabNode JWT, so the
//!   public endpoints are authenticated by the opaque `visitor_token`
//!   minted at session-request time and stored on the row. This is the
//!   same shape `sabchat-widget` uses for its visitor sessions.
//!
//! ## Routes
//!
//! Agent side (`/v1/sabchat/cobrowse`, requires
//! [`AuthUser`](sabnode_auth::AuthUser)):
//!
//! | HTTP route                                  | Handler                              |
//! |---------------------------------------------|--------------------------------------|
//! | `POST  /request/{conversationId}`           | [`handlers::request_session`]        |
//! | `POST  /{sessionId}/end`                    | [`handlers::end_session`]            |
//! | `GET   /?conversationId=`                   | [`handlers::list_sessions`]          |
//!
//! Public side (`/v1/sabchat/cobrowse-public`, **no** JWT — keyed by
//! the `visitorToken`):
//!
//! | HTTP route                                  | Handler                              |
//! |---------------------------------------------|--------------------------------------|
//! | `POST  /{visitorToken}/consent`             | [`public_handlers::grant_consent`]   |
//! | `GET   /{visitorToken}`                     | [`public_handlers::session_status`]  |
//!
//! ## Persistence
//!
//! One Mongo collection — `sabchat_cobrowse_sessions`. Schema:
//!
//! ```text
//! {
//!   _id, tenantId, conversationId, contactId,
//!   visitorToken: String,             // 64-char lowercase hex
//!   agentId?:    ObjectId,            // set on request
//!   status:      "pending"|"active"|"ended",
//!   consentGranted: bool,
//!   maskPasswordFields: bool,
//!   startedAt?, endedAt?, createdAt
//! }
//! ```
//!
//! ## Tenant scope
//!
//! - **Agent endpoints** derive tenant from the conversation row
//!   (request) or the session row (end / list). The caller's
//!   `tenant_id` claim must match — cross-tenant access surfaces as
//!   `404`.
//! - **Public endpoints** derive tenant from the session row identified
//!   by `visitorToken`. There is no JWT to compare; the token itself is
//!   the credential.
//!
//! ## State contract
//!
//! Both routers are generic over the caller's outer state `S`. They
//! need a [`SabChatCobrowseState`] bundle (just a Mongo handle today),
//! and the agent router additionally needs
//! `Arc<sabnode_auth::AuthConfig>` for the JWT verifier; both are
//! pulled via [`FromRef`](axum::extract::FromRef) so this crate stays
//! decoupled from the orchestrator's `AppState` struct.

pub mod dto;
pub mod handlers;
pub mod public_handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatCobrowseState;

/// Build the agent-side co-browse router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/cobrowse`):
///
/// ```text
/// POST  /request/{conversationId}   — request_session
/// POST  /{sessionId}/end            — end_session
/// GET   /                           — list_sessions (?conversationId=)
/// ```
///
/// `S` is the caller's outer application state. The handlers pull a
/// [`SabChatCobrowseState`] bundle plus the JWT verifier config via
/// [`FromRef`] so the router does not have to know about a concrete
/// monolithic state struct.
///
/// **Route ordering note:** the literal `/request/{conversationId}`
/// path is registered before the `/{sessionId}/end` pattern so axum's
/// matcher prefers the literal `request` segment over the
/// `{sessionId}` parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCobrowseState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal segment first ------------------------------------
        .route(
            "/request/{conversation_id}",
            post(handlers::request_session),
        )
        // ---- collection root ------------------------------------------
        .route("/", get(handlers::list_sessions))
        // ---- per-session endpoints ------------------------------------
        .route("/{session_id}/end", post(handlers::end_session))
}

/// Build the public visitor-side co-browse router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/cobrowse-public`):
///
/// ```text
/// POST  /{visitor_token}/consent   — grant_consent
/// GET   /{visitor_token}           — session_status
/// ```
///
/// There is **no [`AuthUser`](sabnode_auth::AuthUser) extractor** on
/// this router — the only credential is the opaque `visitorToken`
/// embedded in the path. Both endpoints surface `404 Not Found` for an
/// unknown token to avoid leaking session enumeration.
pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCobrowseState: FromRef<S>,
{
    Router::new()
        .route(
            "/{visitor_token}/consent",
            post(public_handlers::grant_consent),
        )
        .route("/{visitor_token}", get(public_handlers::session_status))
}
