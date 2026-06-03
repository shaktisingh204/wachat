//! Mountable router for SabWorkerly timesheets.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
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
            get(handlers::list_timesheets).post(handlers::create_timesheet),
        )
        .route(
            "/{timesheetId}",
            get(handlers::get_timesheet)
                .patch(handlers::update_timesheet)
                .delete(handlers::delete_timesheet),
        )
        .route("/{timesheetId}/submit", post(handlers::submit_timesheet))
        .route("/{timesheetId}/approve", post(handlers::approve_timesheet))
        .route("/{timesheetId}/reject", post(handlers::reject_timesheet))
}
