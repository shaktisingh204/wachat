//! Mountable routers for the LeaveRequest entity.
//!
//! ```ignore
//! use crm_leave_requests;
//! .nest("/v1/crm/leave-requests", crm_leave_requests::router::<AppState>())
//! .nest("/v1/sabcrm/people/leave-requests", crm_leave_requests::project_router::<AppState>())
//! ```
//!
//! Note: this is intentionally a separate path from `/v1/hrm/leaves`
//! (the `crm-leaves` crate, which owns the leave-type catalog and the
//! newer `crm_leave_applications` records — and which is the People
//! suite's CANONICAL leave system per people-suite §2.1.5). This crate
//! owns the legacy `crm_leave_requests` collection.

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
            get(handlers::list_requests).post(handlers::create_request),
        )
        .route(
            "/{requestId}",
            get(handlers::get_request)
                .patch(handlers::update_request)
                .delete(handlers::delete_request),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/leave-requests`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM `projectId`-scoped router. Same handlers, same
/// `crm_leave_requests` collection; every request must carry `projectId`
/// (query for `GET`/`PATCH`/`DELETE`, body for `POST`) or it is rejected
/// 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
