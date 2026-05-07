//! Mountable router for the §9.6 PayrollRun endpoints.
//!
//! Mount under `/v1/hrm/payroll-runs` from the host `api` crate:
//!
//! ```ignore
//! use crm_payroll_runs;
//! .nest("/v1/hrm/payroll-runs", crm_payroll_runs::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/hrm/payroll-runs`):
///
/// ```text
/// GET    /                        — list_payroll_runs
/// POST   /                        — create_payroll_run
/// GET    /{runId}                 — get_payroll_run
/// PATCH  /{runId}                 — update_payroll_run
/// DELETE /{runId}                 — delete_payroll_run
/// POST   /{runId}/compute         — compute_payroll_run
/// POST   /{runId}/approve         — approve_payroll_run
/// POST   /{runId}/disburse        — disburse_payroll_run
/// ```
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
            get(handlers::list_payroll_runs).post(handlers::create_payroll_run),
        )
        .route(
            "/{runId}",
            get(handlers::get_payroll_run)
                .patch(handlers::update_payroll_run)
                .delete(handlers::delete_payroll_run),
        )
        .route("/{runId}/compute", post(handlers::compute_payroll_run))
        .route("/{runId}/approve", post(handlers::approve_payroll_run))
        .route("/{runId}/disburse", post(handlers::disburse_payroll_run))
}
