//! Mountable router. Mount under `/v1/sabcliq/workspaces`.

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
            get(handlers::list_workspaces).post(handlers::create_workspace),
        )
        .route(
            "/{workspaceId}",
            get(handlers::get_workspace)
                .patch(handlers::update_workspace)
                .delete(handlers::delete_workspace),
        )
}
