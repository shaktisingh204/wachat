//! Mountable router. Mount under `/v1/sabcheckout/api_keys`.

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
            get(handlers::list_api_keys).post(handlers::create_api_key),
        )
        .route(
            "/{keyId}",
            get(handlers::get_api_key)
                .patch(handlers::update_api_key)
                .delete(handlers::delete_api_key),
        )
}
