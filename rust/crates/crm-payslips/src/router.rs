//! Mountable routers for the Payslip entity.
//!
//! Two constructors share one handler set; the only difference is the
//! [`ScopeMode`] each attaches as an axum `Extension`, which decides the
//! per-request tenant filter key (see `crm_core::scope`):
//!
//! - [`router`] — the legacy `userId`-scoped surface. Mount under
//!   `/v1/crm/payslips`. Behaviour is unchanged.
//! - [`project_router`] — the SabCRM People suite surface, scoped by a
//!   required `projectId`. Mount under `/v1/sabcrm/people/payslips`.
//!
//! Both mounts serve the unified dual-shape read (flat [`crate::types::CrmPayslip`]
//! + rich `hrm_payroll_types::Payslip` — see [`crate::handlers`]) and
//! the `POST /{payslipId}/mark-sent` delivery verb.
//!
//! ```ignore
//! use crm_payslips;
//! .nest("/v1/crm/payslips", crm_payslips::router::<AppState>())
//! .nest("/v1/sabcrm/people/payslips", crm_payslips::project_router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{Extension, Router, extract::FromRef, routing::get, routing::post};
use crm_core::ScopeMode;
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// The shared CRUD + verb route table (no scope attached yet).
fn crud_routes<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_payslips).post(handlers::create_payslip),
        )
        .route(
            "/{payslipId}",
            get(handlers::get_payslip)
                .patch(handlers::update_payslip)
                .delete(handlers::delete_payslip),
        )
        .route(
            "/{payslipId}/mark-sent",
            post(handlers::mark_payslip_sent),
        )
}

/// Legacy `userId`-scoped router — mount under `/v1/crm/payslips`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::User))
}

/// SabCRM People `projectId`-scoped router — mount under
/// `/v1/sabcrm/people/payslips`. Same handlers, same `crm_payslips`
/// collection; every request must carry `projectId` (query for
/// `GET`/`PATCH`/`DELETE`/`POST /{id}/mark-sent`, body for `POST /`) or
/// it is rejected 4xx.
pub fn project_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    crud_routes().layer(Extension(ScopeMode::Project))
}
