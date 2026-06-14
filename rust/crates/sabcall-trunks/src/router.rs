//! Mountable router. Mount under `/v1/sabcall/trunks`.

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
            get(handlers::list_trunks).post(handlers::create_trunk),
        )
        .route(
            "/{trunkId}",
            get(handlers::get_trunk)
                .patch(handlers::update_trunk)
                .delete(handlers::delete_trunk),
        )
}
