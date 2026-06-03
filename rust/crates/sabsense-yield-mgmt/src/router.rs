//! Mountable router. Mount under `/v1/sabsense/yield_mgmts`.

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
        .route("/", get(handlers::list_yield_mgmts).post(handlers::create_yield_mgmt))
        .route(
            "/{yield_mgmtId}",
            get(handlers::get_yield_mgmt)
                .patch(handlers::update_yield_mgmt)
                .delete(handlers::delete_yield_mgmt),
        )
}
