//! # sabchat-dispositions
//!
//! Phase — axum router that owns the SabChat **disposition (close-reason)**
//! HTTP surface. Mounted under `/v1/sabchat/dispositions` from the
//! orchestrating `api` crate:
//!
//! ```ignore
//! .nest(
//!     "/v1/sabchat/dispositions",
//!     sabchat_dispositions::router::<AppState>(),
//! )
//! ```
//!
//! ## Scope
//!
//! A **disposition** is a tenant-defined enum value (e.g. `sale_won`,
//! `not_interested`, `spam`) that agents pick before resolving a
//! conversation. The catalog is tree-able via `parent_code` so tenants
//! can nest reasons (e.g. `sale_won` > `sale_won.upsell`). When applied
//! to a conversation, the chosen code is stored on the conversation
//! itself under `customAttrs.disposition = { code, note?, setBy, setAt }`;
//! the disposition document is **not** copied — the conversation just
//! holds a pointer.
//!
//! ## Collections
//!
//! | Collection                   | Purpose                                 |
//! |------------------------------|-----------------------------------------|
//! | `sabchat_dispositions`       | One doc per disposition (tenant-scoped). |
//! | `sabchat_conversations`      | Receives the `customAttrs.disposition` pointer on apply. |
//! | `sabchat_audit_log`          | `conversation_resolved` event when `alsoResolve` triggers resolution. |
//!
//! ## Routes
//!
//! ```text
//! POST   /                              — create
//! GET    /?active=&parentCode=          — list (tree-able by parent_code)
//! GET    /{id}                          — get
//! PATCH  /{id}                          — update
//! DELETE /{id}                          — delete (soft: set active=false)
//! POST   /apply/{conversationId}        — apply to a conversation
//! GET    /stats?from=&to=               — per-code count over resolved window
//! ```
//!
//! ## Auth + tenancy
//!
//! Every endpoint requires the [`AuthUser`](sabnode_auth::AuthUser)
//! extractor. All Mongo reads and writes scope to
//! `tenantId = ObjectId(auth.tenant_id)` — the router never trusts a
//! tenant-id off the wire.
//!
//! ## State contract
//!
//! [`router`] is generic over the caller's outer state `S`. The handlers
//! need:
//!
//! - a [`SabChatDispositionsState`] bundle (just a Mongo handle today), and
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
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

pub use state::SabChatDispositionsState;

/// Build the SabChat dispositions router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/dispositions`):
///
/// ```text
/// POST   /                              — create
/// GET    /                              — list (filters: active, parentCode)
/// GET    /{id}                          — get
/// PATCH  /{id}                          — update
/// DELETE /{id}                          — delete (soft: active=false)
/// POST   /apply/{conversationId}        — apply
/// GET    /stats                         — per-code stats over a window
/// ```
///
/// **Route ordering note:** the literal segments `/apply/...` and
/// `/stats` are registered before the bare `/{id}` patterns so axum's
/// matcher prefers the literal over the parameter.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatDispositionsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- literal segments first -----------------------------------
        .route(
            "/apply/{conversation_id}",
            post(handlers::apply_disposition),
        )
        .route("/stats", get(handlers::disposition_stats))
        // ---- collection root ------------------------------------------
        .route(
            "/",
            post(handlers::create_disposition).get(handlers::list_dispositions),
        )
        // ---- per-disposition endpoints --------------------------------
        .route(
            "/{id}",
            get(handlers::get_disposition)
                .patch(handlers::update_disposition)
                .delete(handlers::delete_disposition),
        )
}
