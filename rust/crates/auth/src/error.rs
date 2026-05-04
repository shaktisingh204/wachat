//! Auth-layer errors. Each variant maps to a 401 at the HTTP boundary; the
//! `From<AuthError> for ApiError` impl lives at the bottom so callers can
//! `?`-propagate into the shared error type from `sabnode-common`.

use axum::response::{IntoResponse, Response};
use thiserror::Error;

/// Why an inbound request failed authentication.
#[derive(Debug, Error)]
pub enum AuthError {
    /// No `Authorization: Bearer ...` header (or header missing the scheme).
    #[error("missing Authorization bearer token")]
    Missing,

    /// Header was present but the token couldn't be parsed as a JWT.
    #[error("malformed JWT")]
    Malformed,

    /// Signature verified but `exp` is in the past.
    #[error("JWT expired")]
    Expired,

    /// Signature did not verify against the shared secret.
    #[error("invalid JWT signature")]
    BadSignature,

    /// `iss` claim is not `"sabnode-bff"`.
    #[error("unexpected JWT issuer")]
    BadIssuer,
}

// ---------------------------------------------------------------------------
// Bridge to the shared API error type.
//
// `sabnode_common::ApiError::Unauthorized` is being introduced by the agent
// building the `common` crate in parallel; we depend on it being a tuple-like
// or struct-like variant that accepts a `String` reason. Adjust the
// constructor call here if the final shape differs.
// ---------------------------------------------------------------------------
impl From<AuthError> for sabnode_common::ApiError {
    fn from(err: AuthError) -> Self {
        sabnode_common::ApiError::Unauthorized(err.to_string())
    }
}

/// Render through the shared `ApiError` so 401 envelopes match every other
/// error response in the API.
impl IntoResponse for AuthError {
    fn into_response(self) -> Response {
        sabnode_common::ApiError::from(self).into_response()
    }
}
