//! Mountable router. Mount under `/v1/sabwriter/documents`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
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
            get(handlers::list_documents).post(handlers::create_document),
        )
        .route(
            "/{documentId}",
            get(handlers::get_document)
                .patch(handlers::update_document)
                .delete(handlers::delete_document),
        )
        .route("/{documentId}/share", post(handlers::share_document))
}
