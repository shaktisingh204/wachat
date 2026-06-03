use crate::handlers;
use crate::state::SabcatalystApiKeysState;
use axum::{
    Router,
    extract::FromRef,
    routing::{delete, get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystApiKeysState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::list_keys).post(handlers::create_key))
        .route("/{id}", delete(handlers::revoke_key))
        .route("/lookup", post(handlers::lookup_key))
}
