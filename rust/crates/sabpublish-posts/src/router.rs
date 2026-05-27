//! Axum router. Mount under `/v1/sabpublish/posts`.

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
        .route("/", get(handlers::list_posts).post(handlers::create_post))
        .route(
            "/{postId}",
            get(handlers::get_post)
                .patch(handlers::update_post)
                .delete(handlers::delete_post),
        )
}
