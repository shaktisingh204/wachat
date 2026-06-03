use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;

use crate::{handlers, state::SabflowEngineState};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabflowEngineState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/flows/{flow_id}/execute",
            post(handlers::trigger_execution),
        )
        .route("/flows/{flow_id}/activate", post(handlers::activate_flow))
        .route(
            "/flows/{flow_id}/deactivate",
            post(handlers::deactivate_flow),
        )
        .route("/executions/{execution_id}", get(handlers::get_execution))
        .route(
            "/executions/{execution_id}",
            delete(handlers::cancel_execution),
        )
}
