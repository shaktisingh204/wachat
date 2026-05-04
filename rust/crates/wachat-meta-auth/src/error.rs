//! Local error type for `wachat-meta-auth`. Converts cleanly into
//! [`sabnode_common::ApiError`] so callers (handlers, workers) can use `?`
//! at their boundaries without manual mapping.

use sabnode_common::ApiError;
use thiserror::Error;

/// Error variants produced by the token store and refresh helpers.
#[derive(Debug, Error)]
pub enum MetaAuthError {
    /// No token document exists for the requested WABA / phone number.
    #[error("no token record for {kind} `{id}`")]
    NotFound { kind: &'static str, id: String },

    /// Mongo driver returned an error.
    #[error("mongo error: {0}")]
    Mongo(#[from] mongodb::error::Error),

    /// BSON serialization or deserialization failed.
    #[error("bson serialization error: {0}")]
    BsonSer(#[from] bson::ser::Error),

    /// BSON deserialization failed.
    #[error("bson deserialization error: {0}")]
    BsonDe(#[from] bson::de::Error),

    /// HTTP call to Meta failed (network or non-2xx response).
    #[error("meta http error: {0}")]
    Http(#[from] reqwest::Error),

    /// Meta returned a payload that did not match the expected shape.
    #[error("unexpected meta response: {0}")]
    UnexpectedResponse(String),
}

impl From<MetaAuthError> for ApiError {
    fn from(err: MetaAuthError) -> Self {
        match err {
            MetaAuthError::NotFound { kind, id } => ApiError::NotFound(format!("{kind}:{id}")),
            // All other variants are infrastructure / upstream failures —
            // surface them as 500s with the underlying detail preserved
            // through the anyhow chain (logged by `ApiError::IntoResponse`).
            other => ApiError::Internal(anyhow::anyhow!(other)),
        }
    }
}
