//! Engine error type + axum response mapping.

use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use axum::Json;
use serde_json::json;

#[derive(Debug, thiserror::Error)]
pub enum EngineError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("not found: {0}")]
    NotFound(String),
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("asterisk ari error: {0}")]
    Ari(String),
    #[error(transparent)]
    Other(#[from] anyhow::Error),
}

pub type EngineResult<T> = Result<T, EngineError>;

impl IntoResponse for EngineError {
    fn into_response(self) -> Response {
        let (status, msg) = match &self {
            EngineError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            EngineError::NotFound(_) => (StatusCode::NOT_FOUND, self.to_string()),
            EngineError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            EngineError::Ari(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
            EngineError::Other(e) => {
                tracing::error!(error = %e, "internal engine error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal error".to_owned(),
                )
            }
        };
        (status, Json(json!({ "error": msg }))).into_response()
    }
}
