//! Central API error type for the SabNode Rust backend.
//!
//! `ApiError` serializes to a stable JSON envelope:
//! ```json
//! { "ok": false, "error": { "code": "NOT_FOUND", "message": "..." } }
//! ```
//! All HTTP handlers should return `Result<T>` and rely on the
//! `IntoResponse` impl to render error responses uniformly.

use axum::{
    Json,
    http::StatusCode,
    response::{IntoResponse, Response},
};
use serde::Serialize;
use thiserror::Error;

/// Convenience alias used throughout the backend.
pub type Result<T> = std::result::Result<T, ApiError>;

/// Top-level API error. New variants should map to a stable `code` string
/// (UPPER_SNAKE_CASE) and an HTTP status — clients depend on both.
#[derive(Debug, Error)]
pub enum ApiError {
    #[error("not found: {0}")]
    NotFound(String),

    #[error("unauthorized: {0}")]
    Unauthorized(String),

    #[error("forbidden: {0}")]
    Forbidden(String),

    #[error("bad request: {0}")]
    BadRequest(String),

    #[error("conflict: {0}")]
    Conflict(String),

    #[error("validation error: {0}")]
    Validation(String),

    #[error(transparent)]
    Internal(#[from] anyhow::Error),
}

impl ApiError {
    /// Stable machine-readable code shipped in the JSON envelope.
    pub fn code(&self) -> &'static str {
        match self {
            ApiError::NotFound(_) => "NOT_FOUND",
            ApiError::Unauthorized(_) => "UNAUTHORIZED",
            ApiError::Forbidden(_) => "FORBIDDEN",
            ApiError::BadRequest(_) => "BAD_REQUEST",
            ApiError::Conflict(_) => "CONFLICT",
            ApiError::Validation(_) => "VALIDATION_ERROR",
            ApiError::Internal(_) => "INTERNAL_ERROR",
        }
    }

    /// HTTP status code paired with the error variant.
    pub fn status(&self) -> StatusCode {
        match self {
            ApiError::NotFound(_) => StatusCode::NOT_FOUND,
            ApiError::Unauthorized(_) => StatusCode::UNAUTHORIZED,
            ApiError::Forbidden(_) => StatusCode::FORBIDDEN,
            ApiError::BadRequest(_) => StatusCode::BAD_REQUEST,
            ApiError::Conflict(_) => StatusCode::CONFLICT,
            ApiError::Validation(_) => StatusCode::UNPROCESSABLE_ENTITY,
            ApiError::Internal(_) => StatusCode::INTERNAL_SERVER_ERROR,
        }
    }

    /// Client-facing message. Internal errors are intentionally redacted to
    /// avoid leaking implementation details; the full chain is logged below.
    fn client_message(&self) -> String {
        match self {
            ApiError::NotFound(m)
            | ApiError::BadRequest(m)
            | ApiError::Conflict(m)
            | ApiError::Validation(m)
            | ApiError::Unauthorized(m)
            | ApiError::Forbidden(m) => m.clone(),
            ApiError::Internal(_) => "internal server error".to_owned(),
        }
    }
}

/// Inner `error` object inside the response envelope.
#[derive(Debug, Serialize)]
pub struct ErrorBody {
    pub code: &'static str,
    pub message: String,
}

/// Top-level response envelope: `{ ok: false, error: { ... } }`.
#[derive(Debug, Serialize)]
pub struct ErrorEnvelope {
    pub ok: bool,
    pub error: ErrorBody,
}

impl IntoResponse for ApiError {
    fn into_response(self) -> Response {
        let status = self.status();
        let code = self.code();
        let message = self.client_message();

        // Always log server-side. 5xx gets `error`, 4xx gets `warn` so logs
        // stay useful without alerting on client mistakes.
        if status.is_server_error() {
            tracing::error!(error.code = code, error.detail = %self, "request failed");
        } else {
            tracing::warn!(error.code = code, error.detail = %self, "request rejected");
        }

        let body = ErrorEnvelope {
            ok: false,
            error: ErrorBody { code, message },
        };

        (status, Json(body)).into_response()
    }
}
