use std::sync::Arc;

use axum::{Router, extract::FromRef, routing::{get, post}};
use sabnode_auth::AuthConfig;

use crate::{handlers, state::SabflowWebhooksState};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabflowWebhooksState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        .route("/{webhook_id}", get(handlers::handle_get))
        .route("/{webhook_id}", post(handlers::handle_post))
}
