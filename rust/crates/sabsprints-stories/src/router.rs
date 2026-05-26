//! Mountable router. Mount under `/v1/sabsprints/stories`.

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
            get(handlers::list_stories).post(handlers::create_story),
        )
        .route("/reorder", post(handlers::reorder_stories))
        .route(
            "/{storyId}",
            get(handlers::get_story)
                .patch(handlers::update_story)
                .delete(handlers::delete_story),
        )
}
