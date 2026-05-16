//! Mountable router. Mount under `/v1/crm/subtasks`.

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
            get(handlers::list_subtasks).post(handlers::create_subtask),
        )
        .route(
            "/{subtaskId}",
            get(handlers::get_subtask)
                .patch(handlers::update_subtask)
                .delete(handlers::delete_subtask),
        )
}
