//! Mount under `/v1/sablens/annotations`.

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
            get(handlers::list_annotations).post(handlers::create_annotation),
        )
        .route("/{annotationId}", get(handlers::get_annotation).delete(handlers::delete_annotation))
        .route(
            "/by-session/{sessionId}/clear",
            axum::routing::post(handlers::clear_session_annotations),
        )
}
