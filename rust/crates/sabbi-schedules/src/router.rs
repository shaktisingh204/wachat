//! Mountable router. Mount under `/v1/sabbi/schedules`.

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
            get(handlers::list_schedules).post(handlers::create_schedule),
        )
        .route(
            "/{scheduleId}",
            get(handlers::get_schedule)
                .patch(handlers::update_schedule)
                .delete(handlers::delete_schedule),
        )
}
