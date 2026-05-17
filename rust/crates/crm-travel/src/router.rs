//! Mountable router. Mount under `/v1/crm/travel-requests`.

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
            get(handlers::list_travel_requests).post(handlers::create_travel_request),
        )
        .route(
            "/{travelId}",
            get(handlers::get_travel_request)
                .patch(handlers::update_travel_request)
                .delete(handlers::delete_travel_request),
        )
}
