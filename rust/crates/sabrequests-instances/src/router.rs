//! Mountable router for Request Instances.
//!
//! Mount under `/v1/sabrequests/instances` from the host `api` crate.

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
            get(handlers::list_requests).post(handlers::create_request),
        )
        .route(
            "/{requestId}",
            get(handlers::get_request)
                .patch(handlers::update_request)
                .delete(handlers::delete_request),
        )
        .route(
            "/{requestId}/decision",
            post(handlers::decide_request),
        )
}
