//! Mountable router for the §2.5 PayoutReceipt endpoints.
//!
//! Mount under `/v1/crm/payouts` from the host `api` crate:
//!
//! ```ignore
//! use crm_payouts;
//! .nest("/v1/crm/payouts", crm_payouts::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under `/v1/crm/payouts`):
///
/// ```text
/// GET    /                  — list_payouts
/// POST   /                  — create_payout
/// GET    /{payoutId}        — get_payout
/// PATCH  /{payoutId}        — update_payout
/// DELETE /{payoutId}        — delete_payout
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
            get(handlers::list_payouts).post(handlers::create_payout),
        )
        .route(
            "/{payoutId}",
            get(handlers::get_payout)
                .patch(handlers::update_payout)
                .delete(handlers::delete_payout),
        )
}
