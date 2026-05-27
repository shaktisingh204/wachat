//! Mountable router. Mount under `/v1/sabwriter/presence`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post, delete}};
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
        .route("/", get(handlers::list_presence))
        .route("/heartbeat", post(handlers::heartbeat))
        .route("/leave", delete(handlers::leave))
}
