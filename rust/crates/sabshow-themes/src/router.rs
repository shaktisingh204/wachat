//! Mountable router for `/v1/sabshow/themes/*`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// ```text
/// GET    /              — list_themes
/// POST   /              — create_theme
/// GET    /{themeId}     — get_theme
/// PATCH  /{themeId}     — update_theme
/// DELETE /{themeId}     — delete_theme
/// ```
pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_themes).post(handlers::create_theme),
        )
        .route(
            "/{themeId}",
            get(handlers::get_theme)
                .patch(handlers::update_theme)
                .delete(handlers::delete_theme),
        )
}
