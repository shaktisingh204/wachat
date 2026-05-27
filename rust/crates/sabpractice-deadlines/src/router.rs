//! Mountable router for SabPractice deadline endpoints.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
            get(handlers::list_deadlines).post(handlers::create_deadline),
        )
        .route(
            "/{deadlineId}",
            get(handlers::get_deadline)
                .patch(handlers::update_deadline)
                .delete(handlers::delete_deadline),
        )
        .route("/{deadlineId}/file", post(handlers::file_deadline))
}
