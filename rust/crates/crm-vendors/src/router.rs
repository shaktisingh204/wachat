//! Mountable router for the Vendor endpoints.
//!
//! Mount under `/v1/crm/vendors` from the host `api` crate:
//!
//! ```ignore
//! use crm_vendors;
//! .nest("/v1/crm/vendors", crm_vendors::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router. State must expose `MongoHandle` + `Arc<AuthConfig>`
/// via `FromRef` (the standard `AppState` already does).
///
/// Routes (relative — caller nests under `/v1/crm/vendors`):
///
/// ```text
/// GET    /              — list_vendors
/// POST   /              — create_vendor
/// GET    /{vendorId}    — get_vendor
/// PATCH  /{vendorId}    — update_vendor
/// DELETE /{vendorId}    — delete_vendor (hard delete — no status column)
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_vendors).post(handlers::create_vendor),
        )
        .route(
            "/{vendorId}",
            get(handlers::get_vendor)
                .patch(handlers::update_vendor)
                .delete(handlers::delete_vendor),
        )
}
