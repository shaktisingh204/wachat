//! Axum router. Mount under `/v1/sabpublish/locations`.

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
            get(handlers::list_locations).post(handlers::create_location),
        )
        .route(
            "/{locationId}",
            get(handlers::get_location)
                .patch(handlers::update_location)
                .delete(handlers::delete_location),
        )
}
