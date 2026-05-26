//! Mount under `/v1/pagesense/heatmap-events`.

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
        // Authenticated ingest from the Next.js `/api/pagesense/ingest`
        // route handler (which has already validated the snippet key).
        .route("/ingest", post(handlers::ingest_batch))
        // Authenticated reads for the dashboard.
        .route("/", get(handlers::list_events))
}
