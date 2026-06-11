//! Mountable router. Mount under `/v1/sabsheet/ops`.

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
        .route("/", post(handlers::apply_ops).get(handlers::ops_since))
        .route("/snapshot", get(handlers::get_snapshot))
        .route("/export.xlsx", get(handlers::export_xlsx))
        .route("/import.xlsx", post(handlers::import_xlsx))
}
