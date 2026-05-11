use thiserror::Error;

#[derive(Debug, Error)]
pub enum NodeError {
    #[error("Node not implemented: {0}")]
    NotImplemented(String),

    #[error("Missing required parameter: {0}")]
    MissingParameter(String),

    #[error("Invalid parameter value for '{name}': {reason}")]
    InvalidParameter { name: String, reason: String },

    #[error("Credential '{0}' is not configured")]
    MissingCredential(String),

    #[error("HTTP request failed: {0}")]
    HttpError(String),

    #[error("Database error: {0}")]
    DatabaseError(String),

    #[error("Authentication failed: {0}")]
    AuthError(String),

    #[error("Upstream API error ({status}): {body}")]
    UpstreamError { status: u16, body: String },

    #[error("Expression evaluation failed: {0}")]
    ExpressionError(String),

    #[error("Serialization failed: {0}")]
    SerializationError(String),

    #[error("{0}")]
    Other(String),
}

pub type NodeResult<T> = Result<T, NodeError>;

impl From<reqwest::Error> for NodeError {
    fn from(e: reqwest::Error) -> Self {
        NodeError::HttpError(e.to_string())
    }
}

impl From<serde_json::Error> for NodeError {
    fn from(e: serde_json::Error) -> Self {
        NodeError::SerializationError(e.to_string())
    }
}

impl From<anyhow::Error> for NodeError {
    fn from(e: anyhow::Error) -> Self {
        NodeError::Other(e.to_string())
    }
}
