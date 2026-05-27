//! Mountable router for SabWorkerly jobs.

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
        .route("/", get(handlers::list_jobs).post(handlers::create_job))
        .route(
            "/{jobId}",
            get(handlers::get_job)
                .patch(handlers::update_job)
                .delete(handlers::delete_job),
        )
}
