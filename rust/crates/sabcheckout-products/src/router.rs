//! Mountable router. Mount under `/v1/sabcheckout/products`.

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
            get(handlers::list_products).post(handlers::create_product),
        )
        .route(
            "/{id}",
            get(handlers::get_product)
                .patch(handlers::update_product)
                .delete(handlers::delete_product),
        )
}
