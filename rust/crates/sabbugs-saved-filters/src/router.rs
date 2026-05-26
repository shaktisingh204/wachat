//! Mountable router. Mount under `/v1/sabbugs/saved-filters`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch},
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
            get(handlers::list_filters).post(handlers::create_filter),
        )
        .route(
            "/{filterId}",
            patch(handlers::update_filter).delete(handlers::delete_filter),
        )
}
