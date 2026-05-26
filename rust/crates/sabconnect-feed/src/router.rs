//! Mountable router. Mount under `/v1/sabconnect/feed`.

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
            get(handlers::list_feed).post(handlers::create_feed_item),
        )
        .route(
            "/{itemId}",
            get(handlers::get_feed_item)
                .patch(handlers::update_feed_item)
                .delete(handlers::delete_feed_item),
        )
}
