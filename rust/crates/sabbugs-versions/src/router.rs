//! Mountable router. Mount under `/v1/sabbugs/versions`.

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
            get(handlers::list_versions).post(handlers::create_version),
        )
        .route(
            "/{versionId}",
            get(handlers::get_version)
                .patch(handlers::update_version)
                .delete(handlers::delete_version),
        )
}
