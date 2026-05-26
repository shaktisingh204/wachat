//! Mountable router. Mount under `/v1/sabconnect/custom-apps`.

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
        .route("/", get(handlers::list_apps).post(handlers::create_app))
        .route(
            "/{appId}",
            get(handlers::get_app)
                .patch(handlers::update_app)
                .delete(handlers::delete_app),
        )
}
