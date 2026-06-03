//! Mountable router for the §1.4 Sales Order endpoints.
//!
//! Mount under `/v1/crm/sales-orders` from the host `api` crate:
//!
//! ```ignore
//! use crm_sales_orders;
//! .nest("/v1/crm/sales-orders", crm_sales_orders::router::<AppState>())
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
/// Routes (mounted relative — caller nests under
/// `/v1/crm/sales-orders`):
///
/// ```text
/// GET    /                  — list_sales_orders
/// POST   /                  — create_sales_order
/// GET    /{soId}            — get_sales_order
/// PATCH  /{soId}            — update_sales_order
/// DELETE /{soId}            — delete_sales_order
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
            get(handlers::list_sales_orders).post(handlers::create_sales_order),
        )
        .route(
            "/{soId}",
            get(handlers::get_sales_order)
                .patch(handlers::update_sales_order)
                .delete(handlers::delete_sales_order),
        )
}
