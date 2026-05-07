//! Mountable router for the §12.3 Vendor Bid endpoints.
//!
//! Mount under `/v1/crm/vendor-bids` from the host `api` crate:
//!
//! ```ignore
//! use crm_vendor_bids;
//! .nest("/v1/crm/vendor-bids", crm_vendor_bids::router::<AppState>())
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
/// `/v1/crm/vendor-bids`):
///
/// ```text
/// GET    /                  — list_vendor_bids
/// POST   /                  — create_vendor_bid
/// GET    /{bidId}           — get_vendor_bid
/// PATCH  /{bidId}           — update_vendor_bid
/// DELETE /{bidId}           — delete_vendor_bid
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
            get(handlers::list_vendor_bids).post(handlers::create_vendor_bid),
        )
        .route(
            "/{bidId}",
            get(handlers::get_vendor_bid)
                .patch(handlers::update_vendor_bid)
                .delete(handlers::delete_vendor_bid),
        )
}
