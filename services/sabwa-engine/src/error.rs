//! Crate-wide error type used by handlers and services.
//!
//! [`AppError`] implements [`axum::response::IntoResponse`] so handlers can
//! return `Result<T, AppError>` and have errors automatically serialised to a
//! JSON body of the form `{ "error": "<message>", "code": "<machine_code>" }`.

use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

/// Convenient `Result` alias used throughout the crate.
pub type AppResult<T> = std::result::Result<T, AppError>;

/// All errors that can bubble up to an HTTP handler.
#[derive(Debug, Error)]
pub enum AppError {
    /// Resource not found (404).
    #[error("not found")]
    NotFound,
    /// Missing or invalid service token / auth context (401).
    #[error("unauthorized")]
    Unauthorized,
    /// Caller-supplied payload was invalid (400).
    #[error("bad request: {0}")]
    BadRequest(String),
    /// Catch-all for unexpected internal failures (500).
    #[error("internal error: {0}")]
    Internal(#[from] anyhow::Error),
    /// MongoDB driver error (500).
    #[error("mongo error: {0}")]
    Mongo(#[from] mongodb::error::Error),
    /// Redis driver error (500).
    #[error("redis error: {0}")]
    Redis(#[from] redis::RedisError),
}

impl AppError {
    /// HTTP status mapped from the variant.
    pub fn status(&self) -> StatusCode {
        match self {
            AppError::NotFound => StatusCode::NOT_FOUND,
            AppError::Unauthorized => StatusCode::UNAUTHORIZED,
            AppError::BadRequest(_) => StatusCode::BAD_REQUEST,
            AppError::Internal(_) | AppError::Mongo(_) | AppError::Redis(_) => {
                StatusCode::INTERNAL_SERVER_ERROR
            }
        }
    }

    /// Stable, machine-readable code clients can match on.
    pub fn code(&self) -> &'static str {
        match self {
            AppError::NotFound => "not_found",
            AppError::Unauthorized => "unauthorized",
            AppError::BadRequest(_) => "bad_request",
            AppError::Internal(_) => "internal",
            AppError::Mongo(_) => "mongo_error",
            AppError::Redis(_) => "redis_error",
        }
    }
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let status = self.status();
        let code = self.code();
        let message = self.to_string();
        // Walk the source chain so logs include the underlying cause
        // (e.g. the bson deserialize error behind an anyhow context).
        let detail = full_error_chain(&self);

        // Log 5xx errors so operators can correlate them with traces.
        if status.is_server_error() {
            tracing::error!(
                target: "sabwa_engine::error",
                code = %code,
                error = %message,
                detail = %detail,
                "request failed"
            );
        } else {
            tracing::debug!(
                target: "sabwa_engine::error",
                code = %code,
                error = %message,
                detail = %detail,
                "request rejected"
            );
        }

        let body = Json(json!({
            "error": message,
            "code": code,
        }));

        (status, body).into_response()
    }
}

/// Render an error and every link in its `source()` chain, joined by `: `.
/// For `AppError::Internal(anyhow::Error)` this surfaces the original bson /
/// mongo / driver error that an outer context message would otherwise hide.
fn full_error_chain(err: &dyn std::error::Error) -> String {
    let mut out = err.to_string();
    let mut src = err.source();
    while let Some(next) = src {
        out.push_str(": ");
        out.push_str(&next.to_string());
        src = next.source();
    }
    out
}
