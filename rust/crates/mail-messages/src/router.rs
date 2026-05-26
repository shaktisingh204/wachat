//! Mountable router for `/v1/mail/messages`.

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
            get(handlers::list_messages).post(handlers::create_message),
        )
        .route(
            "/{messageId}",
            get(handlers::get_message)
                .patch(handlers::update_message)
                .delete(handlers::delete_message),
        )
}
