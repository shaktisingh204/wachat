//! Mountable router. Mount under `/v1/sabcheckout/ab_tests`.

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
            get(handlers::list_ab_tests).post(handlers::create_ab_test),
        )
        .route(
            "/{ab_testId}",
            get(handlers::get_ab_test)
                .patch(handlers::update_ab_test)
                .delete(handlers::delete_ab_test),
        )
}
