use std::sync::Arc;
use axum::{Router, extract::FromRef, routing::{get, post}};
use sabnode_auth::AuthConfig;
use crate::handlers;
use crate::state::SabcatalystInvocationsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystInvocationsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_invocations))
        .route("/", post(handlers::record_invocation))
}
