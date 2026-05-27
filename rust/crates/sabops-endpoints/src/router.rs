//! Mountable router. Nest under `/v1/sabops/endpoints`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
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
            get(handlers::list_endpoints).post(handlers::create_endpoint),
        )
        .route(
            "/{endpointId}",
            get(handlers::get_endpoint)
                .patch(handlers::update_endpoint)
                .delete(handlers::delete_endpoint),
        )
}
