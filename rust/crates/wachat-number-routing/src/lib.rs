//! # wachat-number-routing
//!
//! Axum router for the `/wachat/two-line` page: phone-number -> team +
//! default-route bindings. Mounted under `/v1/wachat/number-routing`:
//!
//! ```ignore
//! .nest("/v1/wachat/number-routing", wachat_number_routing::router::<AppState>())
//! ```
//!
//! Pure CRUD over `wa_number_team_bindings`, scoped to the authenticated
//! user. Generic over the caller's state `S`; needs a
//! [`WachatNumberRoutingState`] and the JWT verifier config, both pulled
//! via [`FromRef`](axum::extract::FromRef).

pub mod dto;
pub mod handlers;
pub mod state;

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, put},
};
use sabnode_auth::AuthConfig;

pub use state::WachatNumberRoutingState;

/// Build the number-routing router (caller nests under `/v1/wachat/number-routing`).
///
/// ```text
/// GET    /          — list_bindings
/// POST   /          — create_binding
/// PUT    /{id}      — update_binding
/// DELETE /{id}      — delete_binding
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatNumberRoutingState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_bindings).post(handlers::create_binding),
        )
        .route(
            "/{id}",
            put(handlers::update_binding).delete(handlers::delete_binding),
        )
}
