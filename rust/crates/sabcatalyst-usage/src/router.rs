use crate::handlers;
use crate::state::SabcatalystUsageState;
use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;
use std::sync::Arc;

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabcatalystUsageState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/", get(handlers::get_usage))
        .route("/increment", post(handlers::increment_usage))
}
