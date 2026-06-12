//! Mountable routers for the §9.6 PayrollRun endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/hrm/payroll-runs`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM People suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/people/payroll-runs`.
//!   The compute / approve / disburse lifecycle verbs are included on
//!   BOTH mounts — they are tenant-safe because the handlers (and their
//!   cross-collection reads) are scope-aware.
//!
//! ```ignore
//! use crm_payroll_runs;
//! .nest("/v1/hrm/payroll-runs", crm_payroll_runs::router::<AppState>())
//! .nest("/v1/sabcrm/people/payroll-runs", crm_payroll_runs::project_router::<AppState>())
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

/// The shared CRUD + lifecycle route table (no scope attached yet).
///
/// Routes (mounted relative):
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
fn crud_routes<S>() -> Router<S>
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
        .route(
            "/{runId}/generate-payslips",
            post(handlers::generate_payslips),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/hrm/payroll-runs`.
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
/// `/v1/sabcrm/people/payroll-runs`. Same handlers, same
/// `crm_payroll_runs` collection; every request must carry `projectId`
/// (query for `GET`/`PATCH`/`DELETE` and the body-less lifecycle
/// `POST`s, body or query for `POST`) or it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
