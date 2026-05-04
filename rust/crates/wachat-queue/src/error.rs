//! Crate-local error type for the BullMQ producer.
//!
//! Three failure modes:
//!   - Redis transport / Lua errors (anything that fails after we've shipped
//!     the request).
//!   - Payload encoding (caller handed us something `serde_json` refuses).
//!   - Lua script returned a negative sentinel (e.g. duplicate parent key);
//!     we surface the raw integer / message so the caller can map it.
//!
//! The crate-public surface returns `Result<_, sabnode_common::ApiError>`;
//! this enum exists primarily so we can preserve detail at the boundary
//! before it gets folded into `ApiError::Internal(anyhow!)`.

use sabnode_common::ApiError;
use thiserror::Error;

/// Producer-side failure modes. Variants intentionally mirror the three
/// stages of `BullProducer::add`: encode → script-eval → server response.
#[derive(Debug, Error)]
pub enum QueueError {
    /// Anything raised by the underlying `fred` client — connection
    /// drops, command timeouts, RESP parse errors. We keep the original
    /// error so debug logs still surface fred's structured detail.
    #[error("redis error: {0}")]
    Redis(#[from] fred::error::Error),

    /// `serde_json::to_string` rejected the caller-supplied job payload.
    /// Almost always a programmer error (non-stringifiable map key, etc.)
    /// rather than user input.
    #[error("encode error: {0}")]
    Encode(#[from] serde_json::Error),

    /// The Lua script evaluated successfully on the server but returned a
    /// negative sentinel, or the response shape was unexpected. The string
    /// captures whatever context we could extract.
    #[error("script failed: {0}")]
    ScriptFailed(String),
}

impl From<QueueError> for ApiError {
    /// Producer errors are always server-side from the API's perspective:
    /// callers can't fix Redis being down or a bug in our Lua. We collapse
    /// everything to `ApiError::Internal` and let the central handler log
    /// the chain.
    fn from(err: QueueError) -> Self {
        // `anyhow::Error::new` preserves the source chain so
        // `tracing::error!(error.detail = %self)` in `ApiError::IntoResponse`
        // still prints the underlying fred / serde context.
        ApiError::Internal(anyhow::Error::new(err))
    }
}
