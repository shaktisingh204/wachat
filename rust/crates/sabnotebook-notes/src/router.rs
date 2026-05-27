//! Mountable router. Mount under `/v1/sabnotebook/notes`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
            get(handlers::list_notes).post(handlers::create_note),
        )
        .route("/search", get(handlers::search_notes))
        .route(
            "/{noteId}",
            get(handlers::get_note)
                .patch(handlers::update_note)
                .delete(handlers::delete_note),
        )
        .route("/{noteId}/pin", post(handlers::pin_note))
        .route("/{noteId}/archive", post(handlers::archive_note))
}
