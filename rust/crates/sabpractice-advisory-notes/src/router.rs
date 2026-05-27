//! Mountable router for SabPractice advisory-note endpoints.

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
            get(handlers::list_advisory_notes).post(handlers::create_advisory_note),
        )
        .route(
            "/{noteId}",
            get(handlers::get_advisory_note)
                .patch(handlers::update_advisory_note)
                .delete(handlers::delete_advisory_note),
        )
        .route("/{noteId}/share", post(handlers::share_advisory_note))
}
