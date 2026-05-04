//! Error type for media upload/download operations.
//!
//! Maps cleanly into `sabnode_common::ApiError` so HTTP handlers can
//! `?`-bubble Meta failures into the SabNode response envelope. The
//! mapping is conservative:
//!
//! * `MetaApi { status: 4xx }` → `BadRequest` (caller fixable: bad
//!   token, bad mime, missing field, etc).
//! * `MetaApi { status: 5xx }` / `Network` / `Decode` → `Internal`.
//! * `TooLarge` / `Unsupported` → `Validation` (we know up-front the
//!   request is invalid).

use sabnode_common::ApiError;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum MediaError {
    #[error("network error talking to Meta media endpoint: {0}")]
    Network(#[from] reqwest::Error),

    #[error("meta media api returned status {status}: {message}")]
    MetaApi {
        status: u16,
        message: String,
        code: Option<i64>,
    },

    #[error("failed to decode meta response body: {0}")]
    Decode(#[from] serde_json::Error),

    #[error("media exceeds size limit: {0} bytes")]
    TooLarge(u64),

    #[error("unsupported media type: {0}")]
    Unsupported(String),
}

impl From<MediaError> for ApiError {
    fn from(err: MediaError) -> Self {
        match err {
            MediaError::TooLarge(n) => ApiError::Validation(format!("media too large: {n} bytes")),
            MediaError::Unsupported(m) => {
                ApiError::Validation(format!("unsupported media type: {m}"))
            }
            MediaError::MetaApi {
                status, message, ..
            } if (400..500).contains(&status) => {
                ApiError::BadRequest(format!("meta media api {status}: {message}"))
            }
            other => ApiError::Internal(anyhow::Error::new(other)),
        }
    }
}
