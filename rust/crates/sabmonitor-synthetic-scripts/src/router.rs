use crate::handlers;
use axum::{Router, extract::FromRef, routing::get};
use sabnode_auth::AuthConfig;
use sabnode_db::mongo::MongoHandle;
use std::sync::Arc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    MongoHandle: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list).post(handlers::create))
        .route(
            "/{scriptId}",
            get(handlers::get_one)
                .patch(handlers::update)
                .delete(handlers::delete),
        )
}
