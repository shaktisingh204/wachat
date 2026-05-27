//! Mount under `/v1/sablens/frames`.

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
            get(handlers::list_frames).post(handlers::create_frame),
        )
        .route(
            "/{frameId}",
            get(handlers::get_frame).delete(handlers::delete_frame),
        )
}
