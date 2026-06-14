//! Mountable router. Mount under `/v1/sabcall/applications`.

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
            get(handlers::list_applications).post(handlers::create_application),
        )
        .route(
            "/{applicationId}",
            get(handlers::get_application)
                .patch(handlers::update_application)
                .delete(handlers::delete_application),
        )
}
