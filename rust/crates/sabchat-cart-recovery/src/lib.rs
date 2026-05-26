//! # sabchat-cart-recovery
//!
//! Phase — axum router for the SabChat **cart-recovery** HTTP surface.
//!
//! Tenants embed the SabChat widget plus a small JS snippet on their
//! storefront that reports cart events (`add`, `update`, `checkout
//! complete`) back to SabNode. This crate decides — based on
//! tenant-configured rules — when a cart has been idle long enough to
//! count as "abandoned" and what action the widget should take in
//! response (proactive chat prompt, coupon push, etc).
//!
//! Mounted under **two** prefixes from the orchestrating `api` crate:
//!
//! ```ignore
//! .nest("/v1/sabchat/cart-recovery",        sabchat_cart_recovery::router::<AppState>())
//! .nest("/v1/sabchat/cart-recovery-public", sabchat_cart_recovery::public_router::<AppState>())
//! ```
//!
//! In practice the orchestrator nests **both** under the same
//! `/v1/sabchat/cart-recovery` prefix and lets the route layout below
//! pick the right router per path — the public visitor endpoints all
//! live under `/events*`, which doesn't collide with anything in the
//! admin router. The split into two `Router`s exists so the JWT
//! middleware doesn't have to know which paths are exempt.
//!
//! ## Why two routers
//!
//! The agent / admin surface is fully authenticated and scoped by
//! `tenant_id`. The visitor-event surface — called by the storefront
//! snippet on every cart mutation — is anonymous; it recovers the
//! tenant via the inbox row keyed by `inboxId` in the request body.
//! Keeping them in separate routers means we can register
//! [`AuthUser`](sabnode_auth::AuthUser) on the agent router only and
//! leave the public router unauthenticated.
//!
//! ## Routes — visitor (`public_router`)
//!
//! | Method | Path               | Handler                          |
//! |--------|--------------------|----------------------------------|
//! | POST   | `/events`          | `public_handlers::cart_event`    |
//! | POST   | `/events/recover`  | `public_handlers::cart_recover`  |
//!
//! ## Routes — agent / admin (`router`)
//!
//! | Method | Path                | Handler                         |
//! |--------|---------------------|---------------------------------|
//! | POST   | `/rules`            | `handlers::create_rule`         |
//! | GET    | `/rules`            | `handlers::list_rules`          |
//! | GET    | `/rules/{id}`       | `handlers::get_rule`            |
//! | PATCH  | `/rules/{id}`       | `handlers::update_rule`         |
//! | DELETE | `/rules/{id}`       | `handlers::delete_rule`         |
//! | GET    | `/carts`            | `handlers::list_carts`          |
//! | GET    | `/carts/{id}`       | `handlers::get_cart`            |
//! | POST   | `/sweep`            | `handlers::sweep`               |
//! | GET    | `/triggers`         | `handlers::list_triggers`       |
//!
//! ## Tenancy
//!
//! Every agent-side handler scopes its Mongo I/O by
//! `tenantId == ObjectId(auth.tenant_id)`. The public handlers resolve
//! the tenant from the inbox row keyed by `inboxId` in the body — the
//! request never carries a tenant id directly. A request that names an
//! unknown inbox is rejected with `404`.
//!
//! ## Collections
//!
//! - `sabchat_carts` — visitor cart state (one row per `(inboxId,
//!   visitorToken)`).
//! - `sabchat_cart_recovery_rules` — tenant-configured recovery rules.
//! - `sabchat_cart_recovery_triggers` — append-only log of fired
//!   triggers. The widget polls this so it can surface `open_widget`
//!   actions back to the visitor.
//! - `sabchat_inboxes` — read-only here; consulted to resolve the
//!   tenant from a visitor event.
//!
//! ## State contract
//!
//! Both [`router`] and [`public_router`] are generic over the caller's
//! outer state `S`. The agent router needs:
//!
//! - a [`SabChatCartRecoveryState`] bundle (just a Mongo handle today),
//!   and
//! - an `Arc<sabnode_auth::AuthConfig>` (the JWT verifier the
//!   [`AuthUser`](sabnode_auth::AuthUser) extractor reads).
//!
//! The public router only needs the [`SabChatCartRecoveryState`] bundle
//! — there is no [`AuthUser`] extractor on any of its handlers.

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

pub use state::SabChatCartRecoveryState;

// ---------------------------------------------------------------------------
// Collection names — kept on the lib root so both handler modules read
// the same constants. Matching the spec literals 1:1 keeps review easy.
// ---------------------------------------------------------------------------

/// Visitor cart rows, keyed by `(inboxId, visitorToken)`.
pub const CARTS_COLL: &str = "sabchat_carts";

/// Tenant-configured recovery rules.
pub const RULES_COLL: &str = "sabchat_cart_recovery_rules";

/// Append-only log of fired triggers.
pub const TRIGGERS_COLL: &str = "sabchat_cart_recovery_triggers";

/// Read-only — used to resolve a visitor event's tenant from the inbox.
pub const INBOXES_COLL: &str = "sabchat_inboxes";

/// Build the agent-side SabChat cart-recovery router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/sabchat/cart-recovery`):
///
/// ```text
/// POST   /rules                          — create_rule
/// GET    /rules                          — list_rules
/// GET    /rules/{id}                     — get_rule
/// PATCH  /rules/{id}                     — update_rule
/// DELETE /rules/{id}                     — delete_rule
/// GET    /carts                          — list_carts
/// GET    /carts/{id}                     — get_cart
/// POST   /sweep                          — sweep
/// GET    /triggers                       — list_triggers
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCartRecoveryState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // ---- rule CRUD -----------------------------------------------
        .route(
            "/rules",
            post(handlers::create_rule).get(handlers::list_rules),
        )
        .route(
            "/rules/{id}",
            get(handlers::get_rule)
                .patch(handlers::update_rule)
                .delete(handlers::delete_rule),
        )
        // ---- cart read surfaces --------------------------------------
        .route("/carts", get(handlers::list_carts))
        .route("/carts/{id}", get(handlers::get_cart))
        // ---- sweep + trigger log -------------------------------------
        .route("/sweep", post(handlers::sweep))
        .route("/triggers", get(handlers::list_triggers))
}

/// Build the **public-visitor** SabChat cart-recovery router.
///
/// Mounted at the same prefix as the agent router — there is no path
/// overlap because every public route lives under `/events*`. No
/// [`AuthUser`](sabnode_auth::AuthUser) is consumed by any handler in
/// this router; the tenant is recovered from the inbox row referenced
/// in the request body.
///
/// Routes (mounted relative):
///
/// ```text
/// POST   /events                         — cart_event
/// POST   /events/recover                 — cart_recover
/// ```
pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabChatCartRecoveryState: FromRef<S>,
{
    Router::new()
        .route("/events", post(public_handlers::cart_event))
        .route("/events/recover", post(public_handlers::cart_recover))
}
