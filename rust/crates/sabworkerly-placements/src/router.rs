//! Mountable router for SabWorkerly placements.

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
            get(handlers::list_placements).post(handlers::create_placement),
        )
        .route(
            "/{placementId}",
            get(handlers::get_placement)
                .patch(handlers::update_placement)
                .delete(handlers::delete_placement),
        )
}
