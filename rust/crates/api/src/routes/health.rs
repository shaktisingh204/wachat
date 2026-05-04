//! Liveness and readiness probes.
//!
//! - `GET /health` — process is alive (always 200 once the server is up).
//! - `GET /ready`  — process is ready to serve traffic (200 once
//!   `AppState::mark_ready` has been called, 503 otherwise).

use axum::{Json, Router, extract::State, http::StatusCode, response::IntoResponse, routing::get};
use serde_json::json;

use crate::state::AppState;

pub fn router() -> Router<AppState> {
    Router::new()
        .route("/health", get(health))
        .route("/ready", get(ready))
}

async fn health(State(state): State<AppState>) -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "started_at": state.started_at,
    }))
}

async fn ready(State(state): State<AppState>) -> impl IntoResponse {
    if state.is_ready() {
        (
            StatusCode::OK,
            Json(json!({ "status": "ready", "started_at": state.started_at })),
        )
    } else {
        (
            StatusCode::SERVICE_UNAVAILABLE,
            Json(json!({ "status": "starting" })),
        )
    }
}
