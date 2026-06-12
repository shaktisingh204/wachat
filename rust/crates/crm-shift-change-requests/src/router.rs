//! Mountable routers for the Shift Change Request entity.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/shift-change-requests` (the crate was historically never
//!   mounted at all — people-suite WI-12 fixes that).
//! - [`project_router`] — the SabCRM People suite surface, scoped by a
//!   required `projectId`. Mount under
//!   `/v1/sabcrm/people/shift-change-requests`.

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

/// Legacy `userId`-scoped router — mount under
/// `/v1/crm/shift-change-requests`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM People `projectId`-scoped router — mount under
/// `/v1/sabcrm/people/shift-change-requests`. Same handlers, same
/// `crm_shift_change_requests` collection; every request must carry
/// `projectId` (query for `GET`/`PATCH`/`DELETE`, body for `POST`) or
/// it is rejected 4xx. Entity fields stay snake_case on the wire; only
/// the tenant key is camelCase.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
