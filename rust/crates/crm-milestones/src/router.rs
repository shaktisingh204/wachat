//! Mountable router. Mount under `/v1/crm/milestones`.

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
            get(handlers::list_milestones).post(handlers::create_milestone),
        )
        .route(
            "/{milestoneId}",
            get(handlers::get_milestone)
                .patch(handlers::update_milestone)
                .delete(handlers::delete_milestone),
        )
}
