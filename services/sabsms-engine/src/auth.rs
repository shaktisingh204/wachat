use axum::{
    extract::{Request, State},
    middleware::Next,
    response::Response,
};
use std::sync::Arc;

use crate::{errors::EngineError, state::AppState};

/// Axum middleware: require `X-Sabsms-Service-Token` to match the
/// configured token. The webhook routes mount their own auth (provider
/// signature verification) and bypass this.
pub async fn require_service_token(
    State(state): State<Arc<AppState>>,
    req: Request,
    next: Next,
) -> Result<Response, EngineError> {
    let header = req
        .headers()
        .get("x-sabsms-service-token")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("");
    if header != state.cfg.service_token {
        return Err(EngineError::Unauthorized);
    }
    Ok(next.run(req).await)
}
