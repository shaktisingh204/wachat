//! Mountable router. Mount under `/v1/sabcheckout/store_credits`.

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
            get(handlers::list_store_credits).post(handlers::create_store_credit),
        )
        .route(
            "/{store_creditId}",
            get(handlers::get_store_credit)
                .patch(handlers::update_store_credit)
                .delete(handlers::delete_store_credit),
        )
}
