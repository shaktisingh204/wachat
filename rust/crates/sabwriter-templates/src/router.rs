//! Mountable router. Mount under `/v1/sabwriter/templates`.

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
            get(handlers::list_templates).post(handlers::create_template),
        )
        .route(
            "/{templateId}",
            get(handlers::get_template)
                .patch(handlers::update_template)
                .delete(handlers::delete_template),
        )
}
