//! Mountable router for `/v1/sabmail/aliases`.

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
            get(handlers::list_aliases).post(handlers::create_alias),
        )
        .route(
            "/{aliasId}",
            get(handlers::get_alias)
                .patch(handlers::update_alias)
                .delete(handlers::delete_alias),
        )
}
