//! Mountable router. Mount under `/v1/sabcheckout/webhooks`.

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
            get(handlers::list_webhooks).post(handlers::create_webhook),
        )
        .route(
            "/{webhookId}",
            get(handlers::get_webhook)
                .patch(handlers::update_webhook)
                .delete(handlers::delete_webhook),
        )
}
