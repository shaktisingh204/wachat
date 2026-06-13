use axum::{
    http::StatusCode,
    response::{IntoResponse, Response},
    Json,
};
use serde_json::json;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum EngineError {
    #[error("unauthorized")]
    Unauthorized,
    #[error("bad request: {0}")]
    BadRequest(String),
    #[error("not found")]
    NotFound,
    #[error("send failed: {0}")]
    Send(String),
    #[error("mongo: {0}")]
    Mongo(#[from] mongodb::error::Error),
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("internal: {0}")]
    Internal(#[from] anyhow::Error),
}

impl IntoResponse for EngineError {
    fn into_response(self) -> Response {
        let (status, body) = match &self {
            EngineError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            EngineError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            EngineError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            EngineError::Send(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
            EngineError::Mongo(_) | EngineError::Http(_) | EngineError::Internal(_) => {
                tracing::error!(error = ?self, "engine error");
                (StatusCode::INTERNAL_SERVER_ERROR, "internal_error".to_string())
            }
        };
        (status, Json(json!({ "error": body }))).into_response()
    }
}

pub type EngineResult<T> = Result<T, EngineError>;
