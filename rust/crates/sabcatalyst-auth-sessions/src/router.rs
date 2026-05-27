use std::sync::Arc;
use axum::{Router, extract::FromRef, routing::{delete, get}};
use sabnode_auth::AuthConfig;
use crate::handlers;
use crate::state::SabcatalystAuthSessionsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystAuthSessionsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_sessions).post(handlers::issue_session))
        .route("/{id}", delete(handlers::revoke_session))
}
