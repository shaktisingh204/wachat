//! Mountable routers for the Time Log entity.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`:
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/time-logs`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM People suite surface. Mount under
//!   `/v1/sabcrm/people/time-logs`. **WI-13 exception**: the tenant key
//!   is `tenantProjectId` (query for `GET`/`PATCH`/`DELETE`, body for
//!   `POST`), because `projectId` on this entity is the WORK project FK.

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
            get(handlers::list_time_logs).post(handlers::create_time_log),
        )
        .route(
            "/{timeLogId}",
            get(handlers::get_time_log)
                .patch(handlers::update_time_log)
                .delete(handlers::delete_time_log),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/time-logs`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM People tenant-scoped router — mount under
/// `/v1/sabcrm/people/time-logs`. Every request must carry
/// `tenantProjectId` (NOT `projectId` — see crate docs) or it is
/// rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
