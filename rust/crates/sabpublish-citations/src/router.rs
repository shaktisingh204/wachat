//! Axum router. Mount under `/v1/sabpublish/citations`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch, post},
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
        .route("/", get(handlers::list_citations))
        .route("/ingest", post(handlers::ingest_citation))
        .route("/{citationId}", patch(handlers::update_citation))
}
