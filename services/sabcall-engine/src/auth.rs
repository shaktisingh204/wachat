//! Bearer-token guard for control endpoints.

use axum::http::HeaderMap;

use crate::errors::{EngineError, EngineResult};
use crate::state::AppState;

/// Validate the `Authorization: Bearer <SABCALL_ENGINE_TOKEN>` header. When no
/// token is configured the guard is a no-op (local dev), matching the other
/// SabNode engines.
pub fn require_token(state: &AppState, headers: &HeaderMap) -> EngineResult<()> {
    let Some(expected) = state.cfg.engine_token.as_deref() else {
        return Ok(());
    };
    let presented = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .map(str::trim);
    match presented {
        Some(tok) if tok == expected => Ok(()),
        _ => Err(EngineError::Unauthorized),
    }
}
