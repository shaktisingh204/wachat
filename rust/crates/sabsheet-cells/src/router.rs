//! Mountable router. Mount under `/v1/sabsheet/cells`.

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
        .route("/", get(handlers::list_cells).post(handlers::set_cell))
        .route("/evaluate", post(handlers::evaluate_formula))
        .route("/recompute", post(handlers::recompute))
}
