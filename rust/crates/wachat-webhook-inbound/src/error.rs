//! Local error helpers for the inbound processor.
//!
//! We don't define a new error enum — the receiver / API layer already
//! consumes [`ApiError`] via the standard JSON envelope, and persistence
//! failures map cleanly onto `ApiError::Internal(anyhow::Error)`. Keeping
//! this file as a single-module conversion point lets us add structured
//! variants later (e.g. `BadTimestamp`, `MalformedMessage`) without
//! rippling import paths through callers.
//!
//! Convention used in `processor.rs`:
//!
//! ```ignore
//! mongo_collection
//!     .update_one(filter, update)
//!     .upsert(true)
//!     .await
//!     .map_err(map_mongo)?;
//! ```

use sabnode_common::ApiError;

/// Lifts a `mongodb::error::Error` (or any `Into<anyhow::Error>`) into
/// `ApiError::Internal`. Preserves the full error chain in the log envelope.
pub fn map_mongo<E>(err: E) -> ApiError
where
    E: Into<anyhow::Error>,
{
    ApiError::Internal(err.into())
}

/// Lifts a parse failure on the `timestamp` field into a `BadRequest` so
/// callers see a 400 in tests / receiver dispatch instead of a 500. Meta's
/// timestamps are always unix-second strings; a non-integer here is a
/// malformed payload, not an internal fault.
pub fn bad_timestamp(raw: &str) -> ApiError {
    ApiError::BadRequest(format!(
        "inbound message had non-numeric timestamp: {raw:?}"
    ))
}
