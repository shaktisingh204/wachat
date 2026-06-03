use crate::handlers;
use crate::state::SabcatalystFileStoreState;
use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystFileStoreState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_entries).post(handlers::create_entry),
        )
        .route("/{id}", delete(handlers::delete_entry))
}
