//! Mountable router. Mount under `/v1/sabshop/collections`.

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
        .route("/", get(handlers::list_collections).post(handlers::create_collection))
        .route(
            "/{collectionId}",
            get(handlers::get_collection)
                .patch(handlers::update_collection)
                .delete(handlers::delete_collection),
        )
}
