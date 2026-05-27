//! Mountable router. Mount under `/v1/sabassist/devices`.

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
            get(handlers::list_devices).post(handlers::create_device),
        )
        .route(
            "/{deviceId}",
            get(handlers::get_device)
                .patch(handlers::update_device)
                .delete(handlers::delete_device),
        )
}
