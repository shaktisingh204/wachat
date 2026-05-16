//! Mountable router. Mount under `/v1/crm/warehouses` from the host `api` crate.

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
            get(handlers::list_warehouses).post(handlers::create_warehouse),
        )
        .route(
            "/{warehouseId}",
            get(handlers::get_warehouse)
                .patch(handlers::update_warehouse)
                .delete(handlers::delete_warehouse),
        )
}
