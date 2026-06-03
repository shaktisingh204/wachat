//! Mountable router. Mount under `/v1/sabcheckout/secrets`.

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
            get(handlers::list_secrets).post(handlers::create_secret),
        )
        .route(
            "/{secretId}",
            get(handlers::get_secret)
                .patch(handlers::update_secret)
                .delete(handlers::delete_secret),
        )
}
