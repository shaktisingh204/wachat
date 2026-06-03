//! Mountable router for SabWorkerly payroll-runs.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

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
            "/{payrollRunId}",
            get(handlers::get_payroll_run)
                .patch(handlers::update_payroll_run)
                .delete(handlers::delete_payroll_run),
        )
}
