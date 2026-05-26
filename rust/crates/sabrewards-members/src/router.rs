//! Mountable router. Mount under `/v1/sabrewards/members`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
            get(handlers::list_members).post(handlers::create_member),
        )
        .route(
            "/{memberId}",
            get(handlers::get_member).delete(handlers::delete_member),
        )
        .route("/{memberId}/adjust", post(handlers::adjust_points))
}
