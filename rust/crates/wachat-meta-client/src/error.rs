//! Error type for the `wachat-meta-client` transport.
//!
//! `MetaError` is the only error returned from `MetaClient::*` calls.
//! It is convertible into `sabnode_common::ApiError` so handlers can
//! `?`-bubble Meta failures into the SabNode JSON error envelope.

use std::fmt;

use thiserror::Error;

use sabnode_common::ApiError;

/// Errors emitted by the Meta HTTP transport.
#[derive(Debug, Error)]
pub enum MetaError {
    /// Transport-level failure (DNS, TLS, connection reset, body read, …).
    #[error("network error talking to Meta Graph API: {0}")]
    Network(#[source] reqwest::Error),

    /// Response body could not be deserialized into the expected type.
    #[error("failed to decode Meta Graph API response: {0}")]
    Decode(#[source] serde_json::Error),

    /// Meta returned a structured error envelope on a non-2xx response.
    #[error(
        "Meta API error (status={status}, code={code:?}, subcode={subcode:?}, fbtrace_id={fbtrace_id:?}): {message}"
    )]
    Api {
        status: u16,
        code: Option<i64>,
        subcode: Option<i64>,
        fbtrace_id: Option<String>,
        message: String,
    },

    /// Meta returned 429 and we exhausted retries (or `Retry-After` was
    /// too long to wait inline). `retry_after_ms` is the value Meta
    /// suggested, when supplied.
    #[error("Meta API rate limited (retry after {retry_after_ms:?} ms)")]
    RateLimited { retry_after_ms: Option<u64> },

    /// Per-request timeout elapsed (default 30 s).
    #[error("Meta API request timed out")]
    Timeout,
}

impl MetaError {
    /// Convenience: `true` for 4xx non-429 / validation-shaped errors.
    fn is_client_error(&self) -> bool {
        matches!(self, MetaError::Api { status, .. } if (400..500).contains(status) && *status != 429)
    }

    /// Convenience: `true` for 5xx errors.
    fn is_server_error(&self) -> bool {
        matches!(self, MetaError::Api { status, .. } if (500..600).contains(status))
    }
}

impl From<MetaError> for ApiError {
    fn from(err: MetaError) -> Self {
        match &err {
            MetaError::RateLimited { .. } => ApiError::Conflict("rate limited".to_owned()),
            MetaError::Timeout => ApiError::Internal(anyhow::anyhow!("Meta API request timed out")),
            MetaError::Network(_) => ApiError::Internal(anyhow::Error::new(err)),
            MetaError::Decode(_) => ApiError::Internal(anyhow::Error::new(err)),
            MetaError::Api {
                status, message, ..
            } => {
                // Meta's "validation"-style codes (param/format) typically
                // surface as HTTP 400 with type=GraphMethodException — we
                // can't cleanly distinguish from a generic 400 without
                // pattern-matching on `code`, so funnel everything 4xx
                // through BadRequest. Specific codes can be promoted to
                // `Validation` here later if a caller needs the 422.
                if e_is_validation(status, message) {
                    ApiError::Validation(message.clone())
                } else if (400..500).contains(status) {
                    ApiError::BadRequest(message.clone())
                } else {
                    // 5xx (or anything else). Wrap as Internal so the
                    // SabNode response envelope redacts the message.
                    ApiError::Internal(anyhow::Error::new(err))
                }
            }
        }
    }
}

/// Heuristic: classify obvious validation messages as 422-shaped errors.
/// Meta returns `code=100` for "Invalid parameter" plus a descriptive
/// `message`; map that to `Validation` so the SabNode envelope returns
/// `VALIDATION_ERROR` rather than `BAD_REQUEST`.
fn e_is_validation(status: &u16, message: &str) -> bool {
    if *status != 400 {
        return false;
    }
    let m = message.to_ascii_lowercase();
    m.contains("invalid parameter") || m.contains("missing parameter") || m.contains("validation")
}

// `MetaError` already gets a `Display` impl from `#[derive(Error)]`'s
// `#[error("...")]` attributes; assert it explicitly for documentation.
#[allow(dead_code)]
fn _assert_display(e: &MetaError) -> impl fmt::Display + '_ {
    e
}

// Helpful `bool` consumers for downstream auth crates that want to know
// whether a failure is worth re-trying with a refreshed token.
impl MetaError {
    pub fn is_4xx(&self) -> bool {
        self.is_client_error()
    }
    pub fn is_5xx(&self) -> bool {
        self.is_server_error()
    }
}
