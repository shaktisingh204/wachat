use crate::handlers;
use crate::state::SabcatalystRecordsState;
use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, patch},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystRecordsState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route(
            "/",
            get(handlers::list_records).post(handlers::create_record),
        )
        .route("/{id}", get(handlers::get_record))
        .route("/{id}", patch(handlers::update_record))
        .route("/{id}", delete(handlers::delete_record))
}
