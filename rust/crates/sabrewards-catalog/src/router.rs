//! Mountable router. Mount under `/v1/sabrewards/catalog`.

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
            get(handlers::list_items).post(handlers::create_item),
        )
        .route(
            "/{itemId}",
            get(handlers::get_item)
                .patch(handlers::update_item)
                .delete(handlers::delete_item),
        )
}
