//! Mountable router for the §9.3 Attendance endpoints.
//!
//! Mount under `/v1/crm/attendance` from the host `api` crate:
//!
//! ```ignore
//! use crm_attendance;
//! .nest("/v1/crm/attendance", crm_attendance::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under `/v1/crm/attendance`):
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
