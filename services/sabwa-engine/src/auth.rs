//! Service-to-service authentication middleware.
//!
//! The Next.js layer (server actions, route handlers, workers) call this
//! engine over HTTP and must present the shared secret in the
//! `X-Sabwa-Service-Token` header. The `/healthz` endpoint is mounted
//! *before* this middleware in [`crate::build_app`] so liveness probes work
//! without a token.

use axum::{
    body::Body,
    extract::State,
    http::{header::HeaderName, Request, StatusCode},
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;

use crate::state::AppState;

/// Header name carrying the shared service token.
pub const SERVICE_TOKEN_HEADER: HeaderName = HeaderName::from_static("x-sabwa-service-token");

/// Axum middleware that rejects any request whose
/// `X-Sabwa-Service-Token` header does not match
/// [`crate::config::Config::service_token`].
pub async fn require_service_token(
    State(state): State<AppState>,
    req: Request<Body>,
    next: Next,
) -> Response {
    let expected = state.config.service_token.as_str();

    let provided = req
        .headers()
        .get(&SERVICE_TOKEN_HEADER)
        .and_then(|h| h.to_str().ok());

    match provided {
        Some(token) if constant_time_eq(token.as_bytes(), expected.as_bytes()) => {
            next.run(req).await
        }
        _ => unauthorized(),
    }
}

fn unauthorized() -> Response {
    (
        StatusCode::UNAUTHORIZED,
        Json(json!({
            "error": "missing or invalid service token",
            "code": "unauthorized",
        })),
    )
        .into_response()
}

/// Constant-time byte comparison to avoid timing oracles on the token.
fn constant_time_eq(a: &[u8], b: &[u8]) -> bool {
    if a.len() != b.len() {
        return false;
    }
    let mut diff: u8 = 0;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}
