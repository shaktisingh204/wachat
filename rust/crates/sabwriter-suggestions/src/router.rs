//! Mountable router. Mount under `/v1/sabwriter/suggestions`.

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
            get(handlers::list_suggestions).post(handlers::create_suggestion),
        )
        .route("/{suggestionId}", get(handlers::get_suggestion))
        .route("/{suggestionId}/accept", post(handlers::accept_suggestion))
        .route("/{suggestionId}/reject", post(handlers::reject_suggestion))
}
