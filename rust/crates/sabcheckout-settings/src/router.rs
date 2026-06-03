//! Mountable router. Mount under `/v1/sabcheckout/settingss`.

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
            get(handlers::list_settings).post(handlers::create_settings),
        )
        .route(
            "/{settingsId}",
            get(handlers::get_settings)
                .patch(handlers::update_settings)
                .delete(handlers::delete_settings),
        )
}
