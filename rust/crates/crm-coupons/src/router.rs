//! Mountable router. Mount under `/v1/crm/coupons`.

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
            get(handlers::list_coupons).post(handlers::create_coupon),
        )
        .route(
            "/{couponId}",
            get(handlers::get_coupon)
                .patch(handlers::update_coupon)
                .delete(handlers::delete_coupon),
        )
}
