use crate::handlers;
use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use std::sync::Arc;

/// Authenticated CRUD router. Mount at `/v1/sabmonitor/status-pages`.
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_pages).post(handlers::create_page))
        .route(
            "/{pageId}",
            get(handlers::get_page)
                .patch(handlers::update_page)
                .delete(handlers::delete_page),
        )
}

/// **Unauthenticated** public router. Mount at
/// `/v1/sabmonitor/status-pages-public`. Resolves a page by slug and
/// inlines minimal check-status info.
pub fn public_router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
{
    Router::new().route("/{slug}", get(handlers::public_get_by_slug))
}
