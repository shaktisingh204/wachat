//! Mountable router for `/v1/sabvault/folders`.

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
            get(handlers::list_folders).post(handlers::create_folder),
        )
        .route(
            "/{folderId}",
            get(handlers::get_folder)
                .patch(handlers::update_folder)
                .delete(handlers::delete_folder),
        )
}
