//! Mountable router. Mount under `/v1/crm/kb-categories`.

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
            get(handlers::list_categories).post(handlers::create_category),
        )
        .route(
            "/{categoryId}",
            get(handlers::get_category)
                .patch(handlers::update_category)
                .delete(handlers::delete_category),
        )
}
