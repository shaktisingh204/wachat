//! Mountable router. Mount under `/v1/sabshop/shipping-zones`.

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
        .route("/", get(handlers::list_zones).post(handlers::create_zone))
        .route(
            "/{zoneId}",
            get(handlers::get_zone)
                .patch(handlers::update_zone)
                .delete(handlers::delete_zone),
        )
}
