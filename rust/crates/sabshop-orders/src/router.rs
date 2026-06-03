//! Mountable router. Mount under `/v1/sabshop/orders`.

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
        .route("/", get(handlers::list_orders).post(handlers::create_order))
        .route(
            "/{orderId}",
            get(handlers::get_order)
                .patch(handlers::update_order)
                .delete(handlers::delete_order),
        )
}
