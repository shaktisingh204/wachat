//! Mountable router for the §12.3 RFQ endpoints.
//!
//! Mount under `/v1/crm/rfqs` from the host `api` crate:
//!
//! ```ignore
//! use crm_rfqs;
//! .nest("/v1/crm/rfqs", crm_rfqs::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm/rfqs`):
///
/// ```text
/// GET    /                  — list_rfqs
/// POST   /                  — create_rfq
/// GET    /{rfqId}           — get_rfq
/// PATCH  /{rfqId}           — update_rfq
/// DELETE /{rfqId}           — delete_rfq
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
        .route("/", get(handlers::list_rfqs).post(handlers::create_rfq))
        .route(
            "/{rfqId}",
            get(handlers::get_rfq)
                .patch(handlers::update_rfq)
                .delete(handlers::delete_rfq),
        )
}
