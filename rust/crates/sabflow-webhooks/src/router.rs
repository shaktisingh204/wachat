use std::sync::Arc;

use axum::{
    Router,
    extract::FromRef,
    routing::{get, post},
};
use sabnode_auth::AuthConfig;

use crate::{handlers, state::SabflowWebhooksState};

pub fn router<S>() -> Router<S>
where
    S: Clone + Send + Sync + 'static,
    SabflowWebhooksState: FromRef<S>,
    Arc<AuthConfig>: FromRef<S>,
{
    Router::new()
        // Public inbound webhook endpoints (no JWT auth)
        .route("/{webhook_id}", get(handlers::handle_get))
        .route("/{webhook_id}", post(handlers::handle_post))
        // Admin endpoints (JWT auth required) — mounted at /v1/sabflow/webhook-admin
        .route("/admin/register", post(handlers::register_webhook))
        .route(
            "/admin/deactivate/{flow_id}",
            post(handlers::deactivate_webhooks),
        )
}
