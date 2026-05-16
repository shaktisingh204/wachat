//! Mountable router. Mount under `/v1/crm/brands` from the host `api` crate.

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
        .route("/", get(handlers::list_brands).post(handlers::create_brand))
        .route(
            "/{brandId}",
            get(handlers::get_brand)
                .patch(handlers::update_brand)
                .delete(handlers::delete_brand),
        )
}
