//! Mountable router. Mount under `/v1/sabtables/comments`.

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
            get(handlers::list_comments).post(handlers::create_comment),
        )
        .route(
            "/{commentId}",
            get(handlers::get_comment)
                .patch(handlers::update_comment)
                .delete(handlers::delete_comment),
        )
}
