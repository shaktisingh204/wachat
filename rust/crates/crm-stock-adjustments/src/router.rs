//! Mountable routers. Two constructors share one handler set; the only
//! difference is the [`ScopeMode`] each attaches as an axum `Extension`:
//!
//! - [`router`] — legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/stock-adjustments`. Behaviour unchanged.
//! - [`project_router`] — SabCRM Supply suite surface, scoped by a
//!   required `projectId`. Mount under
//!   `/v1/sabcrm/supply/stock-adjustments`.

use std::sync::Arc;

use axum::{
    Extension, Router,
    extract::FromRef,
    routing::{get, post},
};
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
            get(handlers::list_adjustments).post(handlers::create_adjustment),
        )
        .route(
            "/{adjustmentId}",
            get(handlers::get_adjustment)
                .patch(handlers::update_adjustment)
                .delete(handlers::delete_adjustment),
        )
        .route(
            "/{adjustmentId}/approval",
            post(handlers::approval_decision),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/stock-adjustments`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM Supply `projectId`-scoped router — mount under
/// `/v1/sabcrm/supply/stock-adjustments`. Same handlers, same collection;
/// every request must carry `projectId` (query for `GET`/`PATCH`/`DELETE`
/// and the approval `POST`, body for the create `POST`) or it is
/// rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
