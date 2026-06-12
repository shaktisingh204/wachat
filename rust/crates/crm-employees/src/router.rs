//! Mountable routers for the §9.1 Employee endpoints.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/hrm/employees` (and the `/v1/crm/employees` alias). Behaviour
//!   is unchanged.
//! - [`project_router`] — the SabCRM People suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/people/employees`.
//!
//! ```ignore
//! use crm_employees;
//! .nest("/v1/hrm/employees", crm_employees::router::<AppState>())
//! .nest("/v1/sabcrm/people/employees", crm_employees::project_router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared CRUD route table (no scope attached yet).
///
/// Routes (mounted relative):
///
/// ```text
/// GET    /                  — list_employees
/// POST   /                  — create_employee
/// GET    /{employeeId}      — get_employee
/// PATCH  /{employeeId}      — update_employee
/// DELETE /{employeeId}      — delete_employee
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
            get(handlers::list_employees).post(handlers::create_employee),
        )
        .route(
            "/{employeeId}",
            get(handlers::get_employee)
                .patch(handlers::update_employee)
                .delete(handlers::delete_employee),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/hrm/employees`
/// (and the `/v1/crm/employees` alias).
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
/// `/v1/sabcrm/people/employees`. Same handlers, same `crm_employees`
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
