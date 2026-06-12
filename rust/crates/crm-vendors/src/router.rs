//! Mountable routers for the Vendor endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`:
//!
//! - [`router`] — legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/vendors`. Behaviour unchanged.
//! - [`project_router`] — SabCRM Supply suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/supply/vendors`.
//!
//! Routes (relative):
//!
//! ```text
//! GET    /              — list_vendors
//! POST   /              — create_vendor
//! GET    /{vendorId}    — get_vendor
//! PATCH  /{vendorId}    — update_vendor
//! DELETE /{vendorId}    — delete_vendor (hard delete — no status column)
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
            get(handlers::list_vendors).post(handlers::create_vendor),
        )
        .route(
            "/{vendorId}",
            get(handlers::get_vendor)
                .patch(handlers::update_vendor)
                .delete(handlers::delete_vendor),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/vendors`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Supply `projectId`-scoped router — mount under
/// `/v1/sabcrm/supply/vendors`. Same handlers, same collection; every
/// request must carry `projectId` (query for `GET`/`PATCH`/`DELETE`,
/// body for `POST`) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
