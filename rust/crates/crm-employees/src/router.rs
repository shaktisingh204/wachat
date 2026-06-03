//! Mountable router for the §9.1 Employee endpoints.
//!
//! Mount under `/v1/crm/employees` from the host `api` crate:
//!
//! ```ignore
//! use crm_employees;
//! .nest("/v1/crm/employees", crm_employees::router::<AppState>())
//! ```
//!
//! State requirements: any state from which a [`MongoHandle`] and
//! `Arc<AuthConfig>` can be extracted via [`FromRef`]. `sabnode-api`'s
//! `AppState` already implements both.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Build the router.
///
/// Routes (mounted relative — caller nests under `/v1/crm/employees`):
///
/// ```text
/// GET    /                  — list_employees
/// POST   /                  — create_employee
/// GET    /{employeeId}      — get_employee
/// PATCH  /{employeeId}      — update_employee
/// DELETE /{employeeId}      — delete_employee
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
            get(handlers::list_employees).post(handlers::create_employee),
        )
        .route(
            "/{employeeId}",
            get(handlers::get_employee)
                .patch(handlers::update_employee)
                .delete(handlers::delete_employee),
        )
}
