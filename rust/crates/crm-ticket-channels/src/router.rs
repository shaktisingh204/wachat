//! Mountable router. Mount under `/v1/crm/ticket-channels`.

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
            get(handlers::list_channels).post(handlers::create_channel),
        )
        .route(
            "/{channelId}",
            get(handlers::get_channel)
                .patch(handlers::update_channel)
                .delete(handlers::delete_channel),
        )
}
