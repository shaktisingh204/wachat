use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

use crate::{errors::EngineError, state::AppState};

/// Axum middleware: require `X-Sabmail-Service-Token` to match the
/// configured token (mirrors the SabSMS engine). `/health` is mounted
/// outside this layer.
pub async fn require_service_token(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, EngineError> {
    let header = req
        .headers()
        .get("x-sabmail-service-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if header != state.cfg.service_token {
        return Err(EngineError::Unauthorized);
    }
    Ok(next.run(req).await)
}
