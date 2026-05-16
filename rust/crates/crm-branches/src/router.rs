//! Mountable router. Mount under `/v1/crm/branches` from the host `api` crate.

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
            get(handlers::list_branches).post(handlers::create_branch),
        )
        .route(
            "/{branchId}",
            get(handlers::get_branch)
                .patch(handlers::update_branch)
                .delete(handlers::delete_branch),
        )
}
