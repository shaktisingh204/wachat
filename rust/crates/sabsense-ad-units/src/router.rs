//! Mountable router. Mount under `/v1/sabcheckout/ad_units`.

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
        .route("/", get(handlers::list_ad_units).post(handlers::create_ad_unit))
        .route(
            "/{adUnitId}",
            get(handlers::get_ad_unit)
                .patch(handlers::update_ad_unit)
                .delete(handlers::delete_ad_unit),
        )
}
