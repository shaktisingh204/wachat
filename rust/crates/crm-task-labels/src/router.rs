//! Mountable router. Mount under `/v1/crm/task-labels`.

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
            get(handlers::list_task_labels).post(handlers::create_task_label),
        )
        .route(
            "/{labelId}",
            get(handlers::get_task_label)
                .patch(handlers::update_task_label)
                .delete(handlers::delete_task_label),
        )
}
