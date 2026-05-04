//! Local error helpers.
//!
//! The upserter returns `Result<_, sabnode_common::ApiError>` directly so the
//! receiver crate doesn't have to unwrap a third error type. Internal Mongo /
//! driver errors funnel through `anyhow::Error → ApiError::Internal` via the
//! `From` impl already defined on `ApiError`.
//!
//! This module exists for symmetry with the rest of the workspace (every
//! other wachat-* crate has an `error.rs`) and to host any future
//! contact-specific error classes that don't fit `ApiError` cleanly.

use sabnode_common::ApiError;

/// Local alias matching `sabnode_common::Result<T>`. Re-exported so callers
/// can `use wachat_webhook_contacts::error::Result` without also importing
/// the common crate.
pub type Result<T> = std::result::Result<T, ApiError>;
