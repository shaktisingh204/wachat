//! Mountable router. Mount under `/v1/sabconnect/manuals`.

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
            get(handlers::list_manuals).post(handlers::create_manual),
        )
        .route(
            "/{manualId}",
            get(handlers::get_manual)
                .patch(handlers::update_manual)
                .delete(handlers::delete_manual),
        )
}
