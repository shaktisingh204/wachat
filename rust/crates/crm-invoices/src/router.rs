//! Mountable router for the §1.6 Invoice endpoints.
//!
//! Mount under `/v1/crm/invoices` from the host `api` crate:
//!
//! ```ignore
//! use crm_invoices;
//! .nest("/v1/crm/invoices", crm_invoices::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::get,
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under `/v1/crm/invoices`):
///
/// ```text
/// GET    /                  — list_invoices
/// POST   /                  — create_invoice
/// GET    /{invoiceId}       — get_invoice
/// PATCH  /{invoiceId}       — update_invoice
/// DELETE /{invoiceId}       — delete_invoice
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
            get(handlers::list_invoices).post(handlers::create_invoice),
        )
        .route(
            "/{invoiceId}",
            get(handlers::get_invoice)
                .patch(handlers::update_invoice)
                .delete(handlers::delete_invoice),
        )
}
