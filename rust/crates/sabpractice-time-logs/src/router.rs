//! Mountable router for SabPractice time-log endpoints.

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
            get(handlers::list_time_logs).post(handlers::create_time_log),
        )
        .route(
            "/{logId}",
            get(handlers::get_time_log)
                .patch(handlers::update_time_log)
                .delete(handlers::delete_time_log),
        )
}
