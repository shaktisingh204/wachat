//! Mountable router. Mount under `/v1/sabshop/carts`.

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use std::sync::Arc;

use crate::handlers;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_carts).post(handlers::create_cart))
        .route(
            "/{cartId}",
            get(handlers::get_cart)
                .patch(handlers::update_cart)
                .delete(handlers::delete_cart),
        )
}
