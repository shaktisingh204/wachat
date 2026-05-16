//! Mountable router. Mount under `/v1/crm/exits`.

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
        .route("/", get(handlers::list_exits).post(handlers::create_exit))
        .route(
            "/{exitId}",
            get(handlers::get_exit)
                .patch(handlers::update_exit)
                .delete(handlers::delete_exit),
        )
}
