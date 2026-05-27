//! Mountable router. Nest under `/v1/sabops/alerts`.

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
            get(handlers::list_alerts).post(handlers::create_alert),
        )
        .route("/{alertId}/ack", post(handlers::acknowledge_alert))
        .route("/{alertId}/resolve", post(handlers::resolve_alert))
}
