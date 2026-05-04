//! Typed failure modes for webhook signature verification.
//!
//! Every variant maps to `ApiError::Unauthorized` so the wire response
//! is identical regardless of *why* verification failed — distinguishing
//! "missing header" from "bad hex" to a remote caller would leak
//! information about our checks. We keep the rich variant only for
//! server-side logs and tests.

use thiserror::Error;

use sabnode_common::ApiError;

/// Why a webhook signature was rejected.
#[derive(Debug, Error, PartialEq, Eq)]
pub enum VerifyError {
    /// `X-Hub-Signature-256` header was absent.
    #[error("missing X-Hub-Signature-256 header")]
    MissingHeader,

    /// Header was present but did not start with the `sha256=` prefix
    /// (or contained non-ASCII bytes we could not parse).
    #[error("malformed signature header: expected `sha256=<hex>`")]
    BadFormat,

    /// Hex payload after the prefix did not decode.
    #[error("signature hex payload is invalid")]
    BadHex,

    /// HMAC computed over the raw body did not equal the expected digest.
    #[error("signature did not match request body")]
    SignatureMismatch,

    /// Replay-window check rejected an out-of-window timestamp.
    /// Only produced by [`crate::replay::ReplayGuard`]; not used by the
    /// core HMAC verifier.
    #[error("timestamp outside accepted replay window")]
    StaleTimestamp,
}

impl From<VerifyError> for ApiError {
    fn from(err: VerifyError) -> Self {
        // Single client-visible code (`UNAUTHORIZED`); the discriminating
        // detail stays in server logs via `tracing` at the call site.
        ApiError::Unauthorized(match err {
            VerifyError::MissingHeader => "missing webhook signature".to_owned(),
            VerifyError::BadFormat => "malformed webhook signature".to_owned(),
            VerifyError::BadHex => "malformed webhook signature".to_owned(),
            VerifyError::SignatureMismatch => "invalid webhook signature".to_owned(),
            VerifyError::StaleTimestamp => "stale webhook delivery".to_owned(),
        })
    }
}
