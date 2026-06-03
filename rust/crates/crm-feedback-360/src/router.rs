//! Mountable router. Mount under `/v1/crm/feedback-360`.

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
            get(handlers::list_reviews).post(handlers::create_review),
        )
        .route(
            "/{reviewId}",
            get(handlers::get_review)
                .patch(handlers::update_review)
                .delete(handlers::delete_review),
        )
}
