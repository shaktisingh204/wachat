//! Mountable router. Mount under `/v1/crm/estimate-requests`.

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
            get(handlers::list_estimate_requests).post(handlers::create_estimate_request),
        )
        .route(
            "/{requestId}",
            get(handlers::get_estimate_request)
                .patch(handlers::update_estimate_request)
                .delete(handlers::delete_estimate_request),
        )
}
