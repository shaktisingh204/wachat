//! Mountable router. Mount under `/v1/crm/leave-requests`.
//!
//! ```ignore
//! use crm_leave_requests;
//! .nest("/v1/crm/leave-requests", crm_leave_requests::router::<AppState>())
//! ```
//!
//! Note: this is intentionally a separate path from `/v1/hrm/leaves`
//! (the `crm-leaves` crate, which owns the leave-type catalog and the
//! newer `crm_leave_applications` records). This crate owns the legacy
//! `crm_leave_requests` collection.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

pub fn router<S>() -> Router<S>
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
