//! Local error type for the wachat webhook receiver.
//!
//! Most processor failures are caught at the dispatch boundary and routed to
//! the DLQ — they never become a `WebhookError`. The variants here cover the
//! two failure modes that *are* allowed to bubble up to the HTTP layer:
//!
//! * **Signature failure** — the [`wachat_webhook_verify::VerifiedBody`]
//!   extractor already maps these to `ApiError::Unauthorized` directly, so
//!   we mirror its mapping for the rare case where this crate constructs the
//!   error itself (test helpers, manual verification paths).
//! * **Body parse failure** — invalid JSON or a payload that does not match
//!   the `WebhookEvent` shape. Returned as `ApiError::BadRequest`.
//!
//! Both 4xx responses are safe with respect to Meta's retry behavior: Meta
//! logs them in the app dashboard but does not retry them.

use thiserror::Error;

use sabnode_common::ApiError;

/// Errors produced by the webhook receiver itself (not by sibling processors).
#[derive(Debug, Error)]
pub enum WebhookError {
    /// HMAC signature did not match the request body, header was missing, or
    /// the header was malformed. Maps to `401 Unauthorized`.
    #[error("invalid webhook signature")]
    InvalidSignature,

    /// The verified raw body could not be deserialized into a `WebhookEvent`.
    /// Maps to `400 Bad Request`.
    #[error("malformed webhook payload: {0}")]
    Parse(String),
}

impl From<WebhookError> for ApiError {
    fn from(err: WebhookError) -> Self {
        match err {
            WebhookError::InvalidSignature => {
                ApiError::Unauthorized("invalid webhook signature".to_owned())
            }
            WebhookError::Parse(msg) => ApiError::BadRequest(format!("malformed payload: {msg}")),
        }
    }
}

/// Convenience: lift a `serde_json::Error` straight into a `WebhookError`.
impl From<serde_json::Error> for WebhookError {
    fn from(err: serde_json::Error) -> Self {
        WebhookError::Parse(err.to_string())
    }
}
