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
    #[error("suppressed")]
    Suppressed,
    #[error("provider error: {0}")]
    Provider(String),
    #[error("credit reservation rejected: {0}")]
    CreditRejected(String),
    #[error("mongo: {0}")]
    Mongo(#[from] mongodb::error::Error),
    #[error("redis: {0}")]
    Redis(#[from] redis::RedisError),
    #[error("http: {0}")]
    Http(#[from] reqwest::Error),
    #[error("internal: {0}")]
    Internal(#[from] anyhow::Error),
}

impl From<crate::creds::CredsError> for EngineError {
    fn from(e: crate::creds::CredsError) -> Self {
        use crate::creds::CredsError as CE;
        match e {
            CE::NoCredentials | CE::AccountNotFound => EngineError::BadRequest(e.to_string()),
            other => EngineError::Internal(anyhow::anyhow!(other)),
        }
    }
}

impl IntoResponse for EngineError {
    fn into_response(self) -> Response {
        let (status, body) = match &self {
            EngineError::Unauthorized => (StatusCode::UNAUTHORIZED, self.to_string()),
            EngineError::BadRequest(_) => (StatusCode::BAD_REQUEST, self.to_string()),
            EngineError::NotFound => (StatusCode::NOT_FOUND, self.to_string()),
            EngineError::Suppressed => (StatusCode::OK, self.to_string()),
            EngineError::CreditRejected(_) => (StatusCode::PAYMENT_REQUIRED, self.to_string()),
            EngineError::Provider(_) => (StatusCode::BAD_GATEWAY, self.to_string()),
            EngineError::Mongo(_)
            | EngineError::Redis(_)
            | EngineError::Http(_)
            | EngineError::Internal(_) => {
                tracing::error!(error = ?self, "engine error");
                (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    "internal_error".to_string(),
                )
            }
        };
        (status, Json(json!({ "error": body }))).into_response()
    }
}

pub type EngineResult<T> = Result<T, EngineError>;
