//! Mountable router. Mount under `/v1/sabcheckout/order_bumps`.

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
            get(handlers::list_order_bumps).post(handlers::create_order_bump),
        )
        .route(
            "/{order_bumpId}",
            get(handlers::get_order_bump)
                .patch(handlers::update_order_bump)
                .delete(handlers::delete_order_bump),
        )
}
