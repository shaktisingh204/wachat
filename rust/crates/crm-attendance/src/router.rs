//! Mountable routers for the §9.3 Attendance endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/hrm/attendance` (and the `/v1/crm/attendance` alias).
//!   Behaviour is unchanged.
//! - [`project_router`] — the SabCRM People suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/people/attendance`.
//!   The punch shorthand routes are included on BOTH mounts — they are
//!   tenant-safe because the handlers are scope-aware.
//!
//! ```ignore
//! use crm_attendance;
//! .nest("/v1/hrm/attendance", crm_attendance::router::<AppState>())
//! .nest("/v1/sabcrm/people/attendance", crm_attendance::project_router::<AppState>())
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

/// The shared CRUD + punch route table (no scope attached yet).
///
/// Routes (mounted relative):
///
/// ```text
/// GET    /                  — list_attendance
/// POST   /                  — create_attendance
/// GET    /{attendanceId}    — get_attendance
/// PATCH  /{attendanceId}    — update_attendance
/// DELETE /{attendanceId}    — delete_attendance
/// POST   /punch-in          — punch_in    (shorthand mobile flow)
/// POST   /punch-out         — punch_out   (shorthand mobile flow)
/// ```
///
/// Note the punch routes are declared BEFORE the `/{attendanceId}`
/// pattern so axum's route matcher resolves them as literal paths
/// rather than treating `"punch-in"` as a 24-char hex id (it is not, so
/// the OID parse would fail anyway, but explicit ordering keeps the
/// 404 path obvious).
fn crud_routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_attendance).post(handlers::create_attendance),
        )
        .route("/punch-in", post(handlers::punch_in))
        .route("/punch-out", post(handlers::punch_out))
        .route(
            "/{attendanceId}",
            get(handlers::get_attendance)
                .patch(handlers::update_attendance)
                .delete(handlers::delete_attendance),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/hrm/attendance`
/// (and the `/v1/crm/attendance` alias).
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
/// `/v1/sabcrm/people/attendance`. Same handlers, same `crm_attendance`
/// collection; every request must carry `projectId` (query for
/// `GET`/`PATCH`/`DELETE`, body for `POST` incl. the punch routes) or
/// it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
