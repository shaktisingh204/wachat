//! Mountable router. Mount under `/v1/sabsprints/sprints`.

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
            get(handlers::list_sprints).post(handlers::create_sprint),
        )
        .route(
            "/{sprintId}",
            get(handlers::get_sprint)
                .patch(handlers::update_sprint)
                .delete(handlers::delete_sprint),
        )
}
