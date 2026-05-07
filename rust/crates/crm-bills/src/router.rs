//! Mountable router for the §2.3 Bill endpoints.
//!
//! Mount under `/v1/crm/bills` from the host `api` crate:
//!
//! ```ignore
//! use crm_bills;
//! .nest("/v1/crm/bills", crm_bills::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm/bills`):
///
/// ```text
/// GET    /                  — list_bills
/// POST   /                  — create_bill
/// GET    /{billId}          — get_bill
/// PATCH  /{billId}          — update_bill
/// DELETE /{billId}          — delete_bill
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
        .route("/", get(handlers::list_bills).post(handlers::create_bill))
        .route(
            "/{billId}",
            get(handlers::get_bill)
                .patch(handlers::update_bill)
                .delete(handlers::delete_bill),
        )
}
