//! Mountable router. Mount under `/v1/sabcreator/publications`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
            get(handlers::list_publications).post(handlers::publish),
        )
        .route("/{publicationId}", get(handlers::get_publication))
        .route("/latest/{appId}", get(handlers::get_latest_for_app))
}
