//! Mountable router. Mount under `/v1/sabshop/checkouts`.

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
        .route("/", get(handlers::list_checkouts).post(handlers::create_checkout))
        .route(
            "/{checkoutId}",
            get(handlers::get_checkout)
                .patch(handlers::update_checkout)
                .delete(handlers::delete_checkout),
        )
}
