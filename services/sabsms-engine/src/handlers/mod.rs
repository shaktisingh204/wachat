use std::sync::Arc;

use axum::{middleware, routing::post, Router};

use crate::{auth, campaigns, state::AppState};

pub mod health;
pub mod internal;
pub mod send;
pub mod webhook;

pub fn router(state: Arc<AppState>) -> Router {
    // Webhook routes are PUBLIC (provider signature verification is the
    // gate). Service routes require X-Sabsms-Service-Token.
    let service = Router::new()
        .route("/v1/messages", post(send::enqueue))
        .route("/v1/messages/{id}", axum::routing::get(send::get_one))
        .route("/v1/campaigns/{id}/launch", post(campaigns::launch))
        .route("/v1/campaigns/{id}/pause", post(campaigns::pause))
        .route("/v1/campaigns/{id}/resume", post(campaigns::resume))
        .route("/v1/campaigns/{id}/cancel", post(campaigns::cancel))
        .route(
            "/v1/internal/creds/invalidate",
            post(internal::invalidate_creds),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_service_token,
        ));

    let webhooks = Router::new().route(
        "/webhook/{provider}/{direction}",
        post(webhook::handle),
    );

    Router::new()
        .route("/health", axum::routing::get(health::health))
        .merge(service)
        .merge(webhooks)
        .with_state(state)
}
