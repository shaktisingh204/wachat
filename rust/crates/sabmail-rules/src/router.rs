//! Mountable router for `/v1/sabmail/rules`.

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
            get(handlers::list_rules).post(handlers::create_rule),
        )
        .route(
            "/{ruleId}",
            get(handlers::get_rule)
                .patch(handlers::update_rule)
                .delete(handlers::delete_rule),
        )
}
