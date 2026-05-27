//! Mountable router for `/v1/sabshow/comments/*`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// ```text
/// GET    /                — list_comments (?deckId=… [&slideId=…])
/// POST   /                — create_comment
/// PATCH  /{commentId}     — update_comment (body / resolved)
/// DELETE /{commentId}     — delete_comment
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_comments).post(handlers::create_comment),
        )
        .route(
            "/{commentId}",
            axum::routing::patch(handlers::update_comment)
                .delete(handlers::delete_comment),
        )
}
