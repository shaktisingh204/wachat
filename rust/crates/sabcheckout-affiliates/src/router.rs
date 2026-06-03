//! Mountable router. Mount under `/v1/sabcheckout/affiliates`.

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
            get(handlers::list_affiliates).post(handlers::create_affiliate),
        )
        .route(
            "/{affiliateId}",
            get(handlers::get_affiliate)
                .patch(handlers::update_affiliate)
                .delete(handlers::delete_affiliate),
        )
}
