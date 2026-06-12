//! Mountable routers for the §12.3 Vendor Bid endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`:
//!
//! - [`router`] — legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/vendor-bids`. Behaviour unchanged.
//! - [`project_router`] — SabCRM Supply suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/supply/vendor-bids`.
//!
//! Routes (relative):
//!
//! ```text
//! GET    /                  — list_vendor_bids
//! POST   /                  — create_vendor_bid
//! GET    /{bidId}           — get_vendor_bid
//! PATCH  /{bidId}           — update_vendor_bid
//! DELETE /{bidId}           — delete_vendor_bid
//! ```

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

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
            get(handlers::list_vendor_bids).post(handlers::create_vendor_bid),
        )
        .route(
            "/{bidId}",
            get(handlers::get_vendor_bid)
                .patch(handlers::update_vendor_bid)
                .delete(handlers::delete_vendor_bid),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/vendor-bids`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Supply `projectId`-scoped router — mount under
/// `/v1/sabcrm/supply/vendor-bids`. Same handlers, same collection;
/// every request must carry `projectId` (query for `GET`/`PATCH`/
/// `DELETE`, body for `POST`) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
