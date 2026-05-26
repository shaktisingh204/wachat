//! Mountable router for `/v1/sabprep/runs`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Routes (relative — caller nests under `/v1/sabprep/runs`):
///
/// ```text
/// GET /             — list_runs (filter by recipeId / status)
/// GET /{runId}      — get_run
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_runs))
        .route("/{runId}", get(handlers::get_run))
}
