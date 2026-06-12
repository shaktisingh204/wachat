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

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
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
/// The shared CRUD route table (no scope attached yet).
fn crud_routes<S>() -> Router<S>
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

/// Legacy `userId`-scoped router — behaviour unchanged; mount under
/// `/v1/crm/payouts`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Finance `projectId`-scoped router — mount under
/// `/v1/sabcrm/finance/payouts`. Same handlers, same `crm_payouts`
/// collection; every request must carry `projectId` (query for
/// `GET`/`PATCH`/`DELETE`, body for `POST`) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
