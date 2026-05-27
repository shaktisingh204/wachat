//! Mountable router for `/v1/sabshow/slides/*`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, patch, post},
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Routes (relative — caller nests under `/v1/sabshow/slides`):
///
/// ```text
/// GET    /                       — list_slides (?deckId=…)
/// POST   /                       — create_slide
/// GET    /{slideId}              — get_slide
/// PATCH  /{slideId}              — update_slide
/// DELETE /{slideId}              — delete_slide
/// POST   /{slideId}/duplicate    — duplicate_slide
/// PATCH  /{slideId}/reorder      — reorder_slide
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
            get(handlers::list_slides).post(handlers::create_slide),
        )
        .route(
            "/{slideId}",
            get(handlers::get_slide)
                .patch(handlers::update_slide)
                .delete(handlers::delete_slide),
        )
        .route("/{slideId}/duplicate", post(handlers::duplicate_slide))
        .route("/{slideId}/reorder", patch(handlers::reorder_slide))
}
