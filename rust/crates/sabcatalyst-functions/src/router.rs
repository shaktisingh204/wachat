use std::sync::Arc;
use axum::{Router, extract::FromRef, routing::{delete, get, patch, post}};
use sabnode_auth::AuthConfig;
use crate::handlers;
use crate::state::SabcatalystFunctionsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystFunctionsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_functions).post(handlers::create_function))
        .route("/{id}", get(handlers::get_function))
        .route("/{id}", patch(handlers::update_function))
        .route("/{id}", delete(handlers::delete_function))
        .route("/{id}/deployed", post(handlers::mark_deployed))
}
