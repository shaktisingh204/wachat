//! Mountable router. Mount under `/v1/sabcheckout/publishers`.

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
        .route("/", get(handlers::list_publishers).post(handlers::create_publisher))
        .route(
            "/{publisherId}",
            get(handlers::get_publisher)
                .patch(handlers::update_publisher)
                .delete(handlers::delete_publisher),
        )
}
