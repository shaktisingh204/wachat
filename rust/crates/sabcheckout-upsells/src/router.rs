//! Mountable router. Mount under `/v1/sabcheckout/upsells`.

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
            get(handlers::list_upsells).post(handlers::create_upsell),
        )
        .route(
            "/{upsellId}",
            get(handlers::get_upsell)
                .patch(handlers::update_upsell)
                .delete(handlers::delete_upsell),
        )
}
