//! Mountable router. Mount under `/v1/sabcheckout/analyticss`.

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
            get(handlers::list_analytics).post(handlers::create_analytics),
        )
        .route(
            "/{analyticsId}",
            get(handlers::get_analytics)
                .patch(handlers::update_analytics)
                .delete(handlers::delete_analytics),
        )
}
