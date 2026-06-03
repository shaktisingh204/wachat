//! Mountable router. Nest under `/v1/sabops/ad/domains`.

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
        .route(
            "/",
            get(handlers::list_domains).post(handlers::create_domain),
        )
        .route(
            "/{domainId}",
            axum::routing::patch(handlers::update_domain).delete(handlers::delete_domain),
        )
        .route("/{domainId}/sync", post(handlers::sync_domain))
}
