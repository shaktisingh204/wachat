//! DTO for Meta's standard Graph API error envelope.
//!
//! Meta returns errors as:
//! ```json
//! {
//!   "error": {
//!     "message": "...",
//!     "type": "OAuthException",
//!     "code": 190,
//!     "error_subcode": 460,
//!     "fbtrace_id": "AbCdEf123"
//!   }
//! }
//! ```
//! We deserialize this from any non-2xx response body so callers get a
//! structured `MetaError::Api` instead of a raw string.

use serde::Deserialize;

/// The `error` object inside a Meta error envelope.
///
/// All fields are optional because Meta has been known to omit them
/// (e.g. `error_subcode` is missing on most non-OAuth errors).
#[derive(Debug, Clone, Deserialize)]
pub struct MetaApiError {
    /// Human-readable error message. Almost always present.
    pub message: Option<String>,

    /// Meta's error type discriminator (e.g. `"OAuthException"`).
    #[serde(rename = "type")]
    pub error_type: Option<String>,

    /// Top-level numeric error code.
    pub code: Option<i64>,

    /// Optional sub-code that further classifies the error.
    pub error_subcode: Option<i64>,

    /// Trace ID — pass this back to Meta support when reporting issues.
    pub fbtrace_id: Option<String>,

    /// User-facing title (Meta sometimes includes this).
    pub error_user_title: Option<String>,

    /// User-facing message (Meta sometimes includes this).
    pub error_user_msg: Option<String>,
}

/// Top-level envelope: `{ "error": { ... } }`.
#[derive(Debug, Clone, Deserialize)]
pub struct MetaApiErrorEnvelope {
    pub error: MetaApiError,
}
