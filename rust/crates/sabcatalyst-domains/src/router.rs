use std::sync::Arc;
use axum::{Router, extract::FromRef, routing::{delete, get, patch}};
use sabnode_auth::AuthConfig;
use crate::handlers;
use crate::state::SabcatalystDomainsState;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystDomainsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_domains).post(handlers::create_domain))
        .route("/{id}", patch(handlers::update_domain))
        .route("/{id}", delete(handlers::delete_domain))
}
