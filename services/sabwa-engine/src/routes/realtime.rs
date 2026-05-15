//! `/realtime/token` — mint short-lived JWTs the browser can use to subscribe
//! to the SSE/WS streams.
//!
//! This route lives behind the standard service-token middleware so only the
//! Next.js server layer can mint tokens. The returned JWT is bound to a
//! `(projectId, sessionId)` pair and expires after
//! [`crate::auth::DEFAULT_STREAM_TOKEN_TTL_SECS`] seconds.

use axum::{extract::State, routing::post, Json, Router};
use serde::{Deserialize, Serialize};

use crate::auth;
use crate::error::AppError;
use crate::state::AppState;

/// Build the `/realtime` sub-router (currently exposes only `POST /token`).
///
/// The browser-facing SSE/WS handlers live in [`crate::realtime`] and are
/// mounted separately so they can opt out of the service-token middleware.
pub fn router() -> Router<AppState> {
    Router::new().route("/token", post(issue_token))
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTokenRequest {
    pub project_id: String,
    pub session_id: String,
    /// Optional override for the token TTL (seconds). Capped at 1 hour.
    #[serde(default)]
    pub ttl_secs: Option<u64>,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct IssueTokenResponse {
    pub token: String,
    /// Unix seconds at which the token expires.
    pub expires_at: u64,
}

/// Maximum TTL callers can request — keeps the blast radius of a leaked token
/// bounded even when the Next.js side asks for a longer-than-default window.
const MAX_TTL_SECS: u64 = 60 * 60;

async fn issue_token(
    State(state): State<AppState>,
    Json(body): Json<IssueTokenRequest>,
) -> Result<Json<IssueTokenResponse>, AppError> {
    if body.project_id.trim().is_empty() {
        return Err(AppError::BadRequest("projectId is required".into()));
    }
    if body.session_id.trim().is_empty() {
        return Err(AppError::BadRequest("sessionId is required".into()));
    }

    let ttl = body
        .ttl_secs
        .unwrap_or(auth::DEFAULT_STREAM_TOKEN_TTL_SECS)
        .min(MAX_TTL_SECS);

    let (token, expires_at) =
        auth::issue_stream_token(&state, &body.session_id, &body.project_id, ttl)?;

    Ok(Json(IssueTokenResponse { token, expires_at }))
}
