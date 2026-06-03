//! Mountable router. Mount under `/v1/sabsense/floor_pricings`.

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
        .route("/", get(handlers::list_floor_pricings).post(handlers::create_floor_pricing))
        .route(
            "/{floor_pricingId}",
            get(handlers::get_floor_pricing)
                .patch(handlers::update_floor_pricing)
                .delete(handlers::delete_floor_pricing),
        )
}
