//! Error type for the [`crate::wa`] WhatsApp client abstraction.
//!
//! Kept deliberately small — handlers translate [`WaError`] into HTTP
//! responses via [`crate::error::AppError`] (see the `From` impl at the
//! bottom of this file). Worker code matches on these variants to decide
//! whether to retry, escalate, or surface to the user.

use std::fmt;

/// Errors that any [`crate::wa::WaSession`] implementation may return.
#[derive(Debug)]
pub enum WaError {
    /// The session exists but has not completed pairing yet.
    NotPaired,
    /// `start_pair` was called on a session that is already connected.
    AlreadyConnected,
    /// Anti-ban / WA-side rate limit tripped — caller should back off.
    RateLimited,
    /// Stored Baileys auth state was rejected by WA — user must re-pair.
    AuthExpired,
    /// Wire-level protocol failure (e.g. bad frame, decryption error).
    ProtocolError(String),
    /// Underlying socket dropped (transient — pool will reconnect).
    Disconnected,
    /// Anything else (IO, mongo, redis, programmer error). Carries an
    /// `anyhow::Error` so context is preserved up the stack.
    Other(anyhow::Error),
}

impl fmt::Display for WaError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        match self {
            WaError::NotPaired => write!(f, "session is not paired"),
            WaError::AlreadyConnected => write!(f, "session is already connected"),
            WaError::RateLimited => write!(f, "rate limited"),
            WaError::AuthExpired => write!(f, "auth state expired — re-pair required"),
            WaError::ProtocolError(msg) => write!(f, "protocol error: {msg}"),
            WaError::Disconnected => write!(f, "session disconnected"),
            WaError::Other(err) => write!(f, "wa error: {err}"),
        }
    }
}

impl std::error::Error for WaError {
    fn source(&self) -> Option<&(dyn std::error::Error + 'static)> {
        match self {
            WaError::Other(err) => Some(err.as_ref()),
            _ => None,
        }
    }
}

impl From<anyhow::Error> for WaError {
    fn from(err: anyhow::Error) -> Self {
        WaError::Other(err)
    }
}

impl From<WaError> for crate::error::AppError {
    fn from(err: WaError) -> Self {
        match err {
            WaError::NotPaired => crate::error::AppError::BadRequest("session is not paired".into()),
            WaError::AlreadyConnected => {
                crate::error::AppError::BadRequest("session is already connected".into())
            }
            WaError::RateLimited => {
                crate::error::AppError::BadRequest("rate limited — slow down".into())
            }
            WaError::AuthExpired => {
                crate::error::AppError::Unauthorized
            }
            WaError::ProtocolError(msg) => {
                crate::error::AppError::Internal(anyhow::anyhow!("protocol error: {msg}"))
            }
            WaError::Disconnected => {
                crate::error::AppError::Internal(anyhow::anyhow!("session disconnected"))
            }
            WaError::Other(err) => crate::error::AppError::Internal(err),
        }
    }
}
