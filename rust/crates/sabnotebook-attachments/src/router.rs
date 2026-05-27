//! Mountable router. Mount under `/v1/sabnotebook/attachments`.

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
            get(handlers::list_attachments).post(handlers::create_attachment),
        )
        .route(
            "/{attachmentId}",
            get(handlers::get_attachment).delete(handlers::delete_attachment),
        )
}
