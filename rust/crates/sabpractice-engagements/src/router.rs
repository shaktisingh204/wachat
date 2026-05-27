//! Mountable router for SabPractice engagement endpoints.

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
            get(handlers::list_engagements).post(handlers::create_engagement),
        )
        .route(
            "/{engagementId}",
            get(handlers::get_engagement)
                .patch(handlers::update_engagement)
                .delete(handlers::delete_engagement),
        )
}
