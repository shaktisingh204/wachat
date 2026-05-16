//! Mountable router. Mount under `/v1/crm/goals`.

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
        .route("/", get(handlers::list_goals).post(handlers::create_goal))
        .route(
            "/{goalId}",
            get(handlers::get_goal)
                .patch(handlers::update_goal)
                .delete(handlers::delete_goal),
        )
}
