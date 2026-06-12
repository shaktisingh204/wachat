//! Mountable routers for the §9.4 Leave Management endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/hrm/leaves` (and the `/v1/crm/leaves` alias). Behaviour is
//!   unchanged.
//! - [`project_router`] — the SabCRM People suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/people/leaves`. The
//!   approve action is included on BOTH mounts — it is tenant-safe
//!   because the handlers are scope-aware.
//!
//! ```ignore
//! use crm_leaves;
//! .nest("/v1/hrm/leaves", crm_leaves::router::<AppState>())
//! .nest("/v1/sabcrm/people/leaves", crm_leaves::project_router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

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

/// The shared route table (no scope attached yet).
///
/// Routes (mounted relative):
///
/// ```text
/// GET    /types                                — list_leave_types
/// POST   /types                                — create_leave_type
/// GET    /types/{typeId}                       — get_leave_type
/// PATCH  /types/{typeId}                       — update_leave_type
/// DELETE /types/{typeId}                       — delete_leave_type
///
/// GET    /applications                         — list_leave_applications
/// POST   /applications                         — create_leave_application
/// GET    /applications/{applicationId}         — get_leave_application
/// PATCH  /applications/{applicationId}         — update_leave_application
/// DELETE /applications/{applicationId}         — delete_leave_application
///
/// POST   /applications/{applicationId}/approve — approve_leave_application
/// ```
fn crud_routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    let types = Router::<S>::new()
        .route(
            "/",
            get(handlers::list_leave_types).post(handlers::create_leave_type),
        )
        .route(
            "/{typeId}",
            get(handlers::get_leave_type)
                .patch(handlers::update_leave_type)
                .delete(handlers::delete_leave_type),
        );

    let applications = Router::<S>::new()
        .route(
            "/",
            get(handlers::list_leave_applications).post(handlers::create_leave_application),
        )
        .route(
            "/{applicationId}",
            get(handlers::get_leave_application)
                .patch(handlers::update_leave_application)
                .delete(handlers::delete_leave_application),
        )
        // Approve action: state-flip + ApproverStep append. Lives on
        // the same tree as the CRUD endpoints so the approver chain
        // stays adjacent to the resource it mutates.
        .route(
            "/{applicationId}/approve",
            post(handlers::approve_leave_application),
        );

    Router::new()
        .nest("/types", types)
        .nest("/applications", applications)
}

/// Legacy `userId`-scoped router — mount under `/v1/hrm/leaves`
/// (and the `/v1/crm/leaves` alias).
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
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM People `projectId`-scoped router — mount under
/// `/v1/sabcrm/people/leaves`. Same handlers, same `crm_leave_types` +
/// `crm_leave_applications` collections; every request must carry
/// `projectId` (query for `GET`/`PATCH`/`DELETE`, body for `POST`) or
/// it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
