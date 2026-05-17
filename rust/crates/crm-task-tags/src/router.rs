//! Mountable router. Mount under `/v1/crm/task-tags`.

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
            get(handlers::list_task_tags).post(handlers::create_task_tag),
        )
        .route(
            "/{tagId}",
            get(handlers::get_task_tag)
                .patch(handlers::update_task_tag)
                .delete(handlers::delete_task_tag),
        )
}
