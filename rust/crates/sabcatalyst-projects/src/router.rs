//! Axum router builder for `/v1/sabcatalyst/projects`.
//!
//! Mount with:
//! ```ignore
//! .nest("/v1/sabcatalyst/projects", sabcatalyst_projects::router::<AppState>())
//! ```

use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch, post},
};
use sabnode_auth::AuthConfig;

use crate::handlers;
use crate::state::SabcatalystProjectsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystProjectsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_projects).post(handlers::create_project))
        .route("/{id}", get(handlers::get_project))
        .route("/{id}", patch(handlers::update_project))
        .route("/{id}", delete(handlers::delete_project))
}
