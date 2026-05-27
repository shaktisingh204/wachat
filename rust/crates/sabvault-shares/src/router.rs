//! Mountable router for `/v1/sabvault/shares`.

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
            get(handlers::list_shares).post(handlers::create_share),
        )
        .route(
            "/{shareId}",
            post(handlers::update_share)
                .patch(handlers::update_share)
                .delete(handlers::revoke_share),
        )
}
