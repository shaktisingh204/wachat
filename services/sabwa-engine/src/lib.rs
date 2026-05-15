//! sabwa-engine — Rust service powering SabNode's SabWa (WhatsApp) module.
//!
//! Phase 1 status: **scaffold only**. The crate root declares the module
//! layout other agents (R2-R9) will fill in. Right now only `/healthz` and
//! an empty `/v1` router are mounted.
//!
//! See `/SABWA_PLAN.md` (section 2 + section 14) in the repo root for the
//! end-to-end architecture this service plugs into.

pub mod antiban;
pub mod audit;
pub mod auth;
pub mod config;
pub mod crypto;
pub mod db;
pub mod error;
pub mod realtime;
pub mod routes;
pub mod scheduler;
pub mod state;
pub mod types;
pub mod wa;
pub mod webhooks;
pub mod workers;

use axum::{middleware, routing::get, Router};
use tower_http::{cors::CorsLayer, trace::TraceLayer};

use crate::state::AppState;

/// Build the top-level Axum router used by `main.rs` (or by integration tests).
///
/// Layout:
/// - `GET /healthz` — public liveness probe, returns the string `ok`.
/// - `/v1/...` — all real routes, guarded by [`auth::require_service_token`].
///
/// All routes are wrapped with permissive CORS + tracing layers.
pub fn build_app(state: AppState) -> Router {
    // Service-token-gated surface — every nested route requires the shared
    // secret in `X-Sabwa-Service-Token`. `routes::router` already calls
    // `.with_state(state)` internally and returns a stateless `Router`, so we
    // only need to layer the auth middleware on top.
    let api = routes::router(state.clone()).route_layer(middleware::from_fn_with_state(
        state.clone(),
        auth::require_service_token,
    ));

    // Public, API-key-gated surface for external integrators. Built with its
    // own auth middleware in `routes::public_router` and merged here as a
    // sibling so the service-token layer above never sees these requests.
    let public_api = routes::public_router(state.clone());

    // Browser-facing realtime streams (SSE + WS). These authenticate via a
    // short-lived JWT in the `?token=` query string and must NOT carry the
    // service-token middleware, so they're mounted as a sibling of `api`
    // under a distinct top-level prefix. The token-minting endpoint
    // (`POST /v1/realtime/token`) still lives inside `api` and stays
    // service-token gated.
    let realtime_streams = routes::realtime_stream_router(state.clone());

    Router::new()
        .route("/healthz", get(healthz))
        .nest("/v1", api)
        .nest("/v1/public", public_api)
        .nest("/realtime", realtime_streams)
        .layer(CorsLayer::permissive())
        .layer(TraceLayer::new_for_http())
}

/// Simple liveness probe. Intentionally returns a plain-text body so
/// container orchestrators (PM2 / Docker / k8s) can match on `"ok"`.
async fn healthz() -> &'static str {
    "ok"
}
