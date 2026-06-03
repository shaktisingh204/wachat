//! Mountable router. Mount under `/v1/sabcreator/workflows`.

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
            get(handlers::list_workflows).post(handlers::create_workflow),
        )
        .route(
            "/{workflowId}",
            get(handlers::get_workflow)
                .patch(handlers::update_workflow)
                .delete(handlers::delete_workflow),
        )
        .route("/{workflowId}/run", post(handlers::run_workflow))
}
