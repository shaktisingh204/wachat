//! Mountable routers for the Shift entity.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/shifts`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM People suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/people/shifts`.
//!
//! ```ignore
//! use crm_shifts;
//! .nest("/v1/crm/shifts", crm_shifts::router::<AppState>())
//! .nest("/v1/sabcrm/people/shifts", crm_shifts::project_router::<AppState>())
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
        .route("/", get(handlers::list_shifts).post(handlers::create_shift))
        .route(
            "/{shiftId}",
            get(handlers::get_shift)
                .patch(handlers::update_shift)
                .delete(handlers::delete_shift),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/shifts`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM People `projectId`-scoped router — mount under
/// `/v1/sabcrm/people/shifts`. Same handlers, same `crm_shifts`
/// collection; every request must carry `projectId` (query for
/// `GET`/`PATCH`/`DELETE`, body for `POST`) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
