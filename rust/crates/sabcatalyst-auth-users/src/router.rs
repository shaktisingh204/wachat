use std::sync::Arc;
use axum::{Router, extract::FromRef, routing::{delete, get, patch}};
use sabnode_auth::AuthConfig;
use crate::handlers;
use crate::state::SabcatalystAuthUsersState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystAuthUsersState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_auth_users).post(handlers::create_auth_user))
        .route("/{id}", get(handlers::get_auth_user))
        .route("/{id}", patch(handlers::update_auth_user))
        .route("/{id}", delete(handlers::delete_auth_user))
}
