//! Mountable router. Mount under `/v1/sabshop/storefronts`.

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
            get(handlers::list_storefronts).post(handlers::create_storefront),
        )
        .route(
            "/{storefrontId}",
            get(handlers::get_storefront)
                .patch(handlers::update_storefront)
                .delete(handlers::delete_storefront),
        )
}
