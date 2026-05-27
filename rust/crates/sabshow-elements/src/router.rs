//! Mountable router for `/v1/sabshow/elements/*`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::get,
};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;

use crate::handlers;

/// Routes (relative — caller nests under `/v1/sabshow/elements`):
///
/// ```text
/// GET    /                — list_elements (?slideId=… | ?deckId=…)
/// POST   /                — create_element
/// GET    /{elementId}     — get_element
/// PATCH  /{elementId}     — update_element
/// DELETE /{elementId}     — delete_element
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
            get(handlers::list_elements).post(handlers::create_element),
        )
        .route(
            "/{elementId}",
            get(handlers::get_element)
                .patch(handlers::update_element)
                .delete(handlers::delete_element),
        )
}
