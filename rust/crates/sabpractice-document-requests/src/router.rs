//! Mountable router for SabPractice document-request endpoints.

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
            get(handlers::list_doc_requests).post(handlers::create_doc_request),
        )
        .route(
            "/{requestId}",
            get(handlers::get_doc_request)
                .patch(handlers::update_doc_request)
                .delete(handlers::delete_doc_request),
        )
}
