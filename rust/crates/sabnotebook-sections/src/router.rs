//! Mountable router. Mount under `/v1/sabnotebook/sections`.

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
            get(handlers::list_sections).post(handlers::create_section),
        )
        .route(
            "/{sectionId}",
            get(handlers::get_section)
                .patch(handlers::update_section)
                .delete(handlers::delete_section),
        )
}
