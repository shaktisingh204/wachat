use crate::handlers;
use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use std::sync::Arc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_incidents).post(handlers::create_incident),
        )
        .route(
            "/{incidentId}/acknowledge",
            post(handlers::acknowledge_incident),
        )
        .route("/{incidentId}/resolve", post(handlers::resolve_incident))
}
