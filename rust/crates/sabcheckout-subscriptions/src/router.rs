//! Mountable router. Mount under `/v1/sabcheckout/subscriptions`.

use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
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
            get(handlers::list_subscriptions).post(handlers::create_subscription),
        )
        .route(
            "/{subscriptionId}",
            get(handlers::get_subscription).patch(handlers::update_subscription),
        )
        .route(
            "/{subscriptionId}/cancel",
            post(handlers::cancel_subscription),
        )
}
