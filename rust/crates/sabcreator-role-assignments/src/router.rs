//! Mountable router. Mount under `/v1/sabcreator/role-assignments`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get},
};
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
            get(handlers::list_assignments).post(handlers::create_assignment),
        )
        .route("/{assignmentId}", delete(handlers::delete_assignment))
}
