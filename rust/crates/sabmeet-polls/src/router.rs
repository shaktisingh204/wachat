//! Mountable router. Mount under `/v1/sabmeet/polls`.

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
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
        .route("/", get(handlers::list_polls).post(handlers::create_poll))
        .route("/{pollId}/vote", post(handlers::vote_poll))
        .route("/{pollId}/close", post(handlers::close_poll))
}
