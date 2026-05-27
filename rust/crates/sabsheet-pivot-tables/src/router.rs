//! Mountable router. Mount under `/v1/sabsheet/pivot-tables`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, patch}};
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
        .route("/", get(handlers::list_pivots).post(handlers::create_pivot))
        .route(
            "/{id}",
            patch(handlers::update_pivot).delete(handlers::delete_pivot),
        )
}
