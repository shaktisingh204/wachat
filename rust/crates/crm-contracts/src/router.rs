//! Mountable router. Mount under `/v1/crm/contracts`.

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
            get(handlers::list_contracts).post(handlers::create_contract),
        )
        .route(
            "/{contractId}",
            get(handlers::get_contract)
                .patch(handlers::update_contract)
                .delete(handlers::delete_contract),
        )
}
