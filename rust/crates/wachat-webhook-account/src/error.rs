//! Error helpers for the account-webhook processor.
//!
//! We deliberately reuse `sabnode_common::ApiError` so failures plug into the
//! same JSON envelope the rest of the backend speaks. This module exists only
//! to keep the conversion of Mongo / BSON errors in one place.
//!
//! Per the slice contract: **never panic, never surface an error for an
//! unknown field**. Unknown fields log at `warn` and still write to
//! `account_events`. Errors are reserved for actual Mongo I/O failures.

use sabnode_common::ApiError;

/// Convert a `mongodb::error::Error` (or any `anyhow`-able error) into an
/// `ApiError::Internal`. Mongo write failures are not the user's fault; they
/// surface as 500 with the standard error envelope.
pub fn mongo_err<E: Into<anyhow::Error>>(e: E) -> ApiError {
    ApiError::Internal(e.into())
}
