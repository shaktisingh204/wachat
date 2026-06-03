//! Mountable router for the §9.2 Department + Designation endpoints.
//!
//! Mount under `/v1/crm` from the host `api` crate — this crate
//! contributes BOTH `/departments/*` and `/designations/*` subtrees:
//!
//! ```ignore
//! use crm_departments;
//! .nest("/v1/crm", crm_departments::router::<AppState>())
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
/// Routes (mounted relative — caller nests under `/v1/crm`):
///
/// ```text
/// GET    /departments                  — list_departments
/// POST   /departments                  — create_department
/// GET    /departments/{departmentId}   — get_department
/// PATCH  /departments/{departmentId}   — update_department
/// DELETE /departments/{departmentId}   — delete_department
///
/// GET    /designations                 — list_designations
/// POST   /designations                 — create_designation
/// GET    /designations/{designationId} — get_designation
/// PATCH  /designations/{designationId} — update_designation
/// DELETE /designations/{designationId} — delete_designation
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
        // Departments tree.
        .route(
            "/departments",
            get(handlers::list_departments).post(handlers::create_department),
        )
        .route(
            "/departments/{departmentId}",
            get(handlers::get_department)
                .patch(handlers::update_department)
                .delete(handlers::delete_department),
        )
        // Designations tree.
        .route(
            "/designations",
            get(handlers::list_designations).post(handlers::create_designation),
        )
        .route(
            "/designations/{designationId}",
            get(handlers::get_designation)
                .patch(handlers::update_designation)
                .delete(handlers::delete_designation),
        )
}
