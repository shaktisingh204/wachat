//! Mountable router for the §12.1 Subscription endpoints.
//!
//! Mount under `/v1/crm/subscriptions` from the host `api` crate:
//!
//! ```ignore
//! use crm_subscriptions;
//! .nest("/v1/crm/subscriptions", crm_subscriptions::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under
/// `/v1/crm/subscriptions`):
///
/// ```text
/// GET    /                  — list_subscriptions
/// POST   /                  — create_subscription
/// GET    /{id}              — get_subscription
/// PATCH  /{id}              — update_subscription
/// DELETE /{id}              — delete_subscription
/// POST   /{id}/pause        — pause_subscription
/// ```
///
/// `S` is the caller's outer application state. Handlers need a
/// [`MongoHandle`] (data access) and `Arc<AuthConfig>` (the JWT
/// verifier the `AuthUser` extractor reads). Both are pulled via
/// [`FromRef`] so this crate stays decoupled from the orchestrator's
/// concrete `AppState`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_subscriptions).post(handlers::create_subscription),
        )
        .route(
            "/{id}",
            get(handlers::get_subscription)
                .patch(handlers::update_subscription)
                .delete(handlers::delete_subscription),
        )
        .route("/{id}/pause", post(handlers::pause_subscription))
}
