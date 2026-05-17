//! Mountable router. Mount under `/v1/crm/learning-paths`.

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
            get(handlers::list_learning_paths).post(handlers::create_learning_path),
        )
        .route(
            "/{learningPathId}",
            get(handlers::get_learning_path)
                .patch(handlers::update_learning_path)
                .delete(handlers::delete_learning_path),
        )
}
