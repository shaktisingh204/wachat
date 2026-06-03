//! Mountable router. Mount under `/v1/sabsense/native_ads`.

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
        .route("/", get(handlers::list_native_ads).post(handlers::create_native_ad))
        .route(
            "/{native_adId}",
            get(handlers::get_native_ad)
                .patch(handlers::update_native_ad)
                .delete(handlers::delete_native_ad),
        )
}
