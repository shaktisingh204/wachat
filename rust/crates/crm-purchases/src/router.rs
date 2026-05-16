//! Mountable router. Mount under `/v1/crm/purchases`.

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
            get(handlers::list_purchases).post(handlers::create_purchase),
        )
        .route(
            "/{purchaseId}",
            get(handlers::get_purchase)
                .patch(handlers::update_purchase)
                .delete(handlers::delete_purchase),
        )
}
