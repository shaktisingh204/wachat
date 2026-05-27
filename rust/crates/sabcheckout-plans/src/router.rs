//! Mountable router. Mount under `/v1/sabcheckout/plans`.

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
        .route("/", get(handlers::list_plans).post(handlers::create_plan))
        .route(
            "/{planId}",
            get(handlers::get_plan)
                .patch(handlers::update_plan)
                .delete(handlers::delete_plan),
        )
}
