//! # wachat-integrations-hub
//!
//! Axum router for the OAuth-connection bookkeeping behind the
//! `/wachat/integrations` page (OAuth Connections tab). Mounted under
//! `/v1/wachat/integrations`:
//!
//! ```ignore
//! .nest("/v1/wachat/integrations", wachat_integrations_hub::router::<AppState>())
//! ```
//!
//! Scope is intentionally narrow: this crate only records which OAuth
//! providers a tenant has connected (`wa_oauth_connections`, keyed by
//! `{userId, provider}`). The actual OAuth handoff stays in Next.js;
//! razorpay / link-clicks / widget live in their own crates.
//!
//! Generic over the caller's state `S`; needs a
//! [`WachatIntegrationsHubState`] and the JWT verifier config, both
//! pulled via [`FromRef`](axum::extract::FromRef).

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

pub use state::WachatIntegrationsHubState;

/// Build the integrations-hub router (caller nests under
/// `/v1/wachat/integrations`).
///
/// ```text
/// GET    /oauth                      — list_connections
/// POST   /oauth/{provider}/connect   — connect_provider
/// DELETE /oauth/{provider}           — disconnect_provider
/// ```
///
/// Literal `/oauth` segments are registered before the `{provider}`
/// param routes, as axum 0.8 requires.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    WachatIntegrationsHubState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/oauth", get(handlers::list_connections))
        .route(
            "/oauth/{provider}/connect",
            post(handlers::connect_provider),
        )
        .route("/oauth/{provider}", delete(handlers::disconnect_provider))
}
