//! Mountable router for the §1.2 Quotation endpoints.
//!
//! Mount under `/v1/crm/quotations` from the host `api` crate:
//!
//! ```ignore
//! use crm_quotations;
//! .nest("/v1/crm/quotations", crm_quotations::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm/quotations`):
///
/// ```text
/// GET    /                       — list_quotations
/// POST   /                       — create_quotation
/// GET    /{quotationId}          — get_quotation
/// PATCH  /{quotationId}          — update_quotation
/// DELETE /{quotationId}          — delete_quotation
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
            get(handlers::list_quotations).post(handlers::create_quotation),
        )
        .route(
            "/{quotationId}",
            get(handlers::get_quotation)
                .patch(handlers::update_quotation)
                .delete(handlers::delete_quotation),
        )
}
