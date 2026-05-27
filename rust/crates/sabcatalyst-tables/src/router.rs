use std::sync::Arc;
use axum::{Router, extract::FromRef, routing::{delete, get, patch}};
use sabnode_auth::AuthConfig;
use crate::handlers;
use crate::state::SabcatalystTablesState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystTablesState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_tables).post(handlers::create_table))
        .route("/{id}", get(handlers::get_table))
        .route("/{id}", patch(handlers::update_table))
        .route("/{id}", delete(handlers::delete_table))
}
