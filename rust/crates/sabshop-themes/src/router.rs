//! Mountable router. Mount under `/v1/sabshop/themes`.

use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use std::sync::Arc;

use crate::handlers;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_themes).post(handlers::create_theme))
        .route(
            "/{themeId}",
            get(handlers::get_theme)
                .patch(handlers::update_theme)
                .delete(handlers::delete_theme),
        )
}
