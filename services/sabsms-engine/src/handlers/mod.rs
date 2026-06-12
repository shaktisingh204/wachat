use std::sync::Arc;

use axum::{middleware, routing::post, Router};

use crate::{auth, campaigns, state::AppState};

pub mod health;
pub mod internal;
pub mod numbers;
pub mod send;
pub mod webhook;

pub fn router(state: Arc<AppState>) -> Router {
    // Webhook routes are PUBLIC (provider signature verification — or the
    // per-account URL secret — is the gate). Service routes require
    // X-Sabsms-Service-Token.
    // NOTE: axum 0.7 (matchit) uses `:param` capture syntax — `{param}`
    // registers a LITERAL segment and silently 404s every real id.
    let service = Router::new()
        .route("/v1/messages", post(send::enqueue))
        .route("/v1/messages/:id", axum::routing::get(send::get_one))
        .route("/v1/campaigns/:id/launch", post(campaigns::launch))
        .route("/v1/campaigns/:id/pause", post(campaigns::pause))
        .route("/v1/campaigns/:id/resume", post(campaigns::resume))
        .route("/v1/campaigns/:id/cancel", post(campaigns::cancel))
        .route("/v1/numbers/search", post(numbers::search))
        .route("/v1/numbers/provision", post(numbers::provision))
        .route(
            "/v1/internal/creds/invalidate",
            post(internal::invalidate_creds),
        )
        .route(
            "/v1/internal/providers/test",
            post(internal::test_provider),
        )
        .route(
            "/v1/internal/routing/invalidate",
            post(internal::invalidate_routing),
        )
        .route(
            "/v1/internal/routing/preview",
            post(internal::preview_route),
        )
        .route(
            "/v1/health/providers",
            axum::routing::get(health::providers_health),
        )
        .route_layer(middleware::from_fn_with_state(
            state.clone(),
            auth::require_service_token,
        ));

    let webhooks = Router::new()
        // Legacy Twilio (+ mock) route — kept for already-configured URLs.
        .route("/webhook/:provider/:direction", post(webhook::handle))
        // Generic multi-provider route. GET supports providers (Gupshup)
        // that deliver DLR/inbound callbacks as query-string GETs.
        .route(
            "/webhook/:provider/:account_id/:direction",
            post(webhook::handle_account).get(webhook::handle_account),
        );

    Router::new()
        .route("/health", axum::routing::get(health::health))
        .merge(service)
        .merge(webhooks)
        .with_state(state)
}
