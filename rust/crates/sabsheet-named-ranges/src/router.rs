//! Mountable router. Mount under `/v1/sabsheet/named-ranges`.

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
            get(handlers::list_named_ranges).post(handlers::create_named_range),
        )
        .route(
            "/{id}",
            axum::routing::patch(handlers::update_named_range)
                .delete(handlers::delete_named_range),
        )
}
