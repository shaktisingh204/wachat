//! Local error helpers.
//!
//! The processor returns `Result<_, sabnode_common::ApiError>` directly so
//! the dispatcher crate doesn't have to unwrap a third error type. Internal
//! Mongo / driver errors funnel through `anyhow::Error → ApiError::Internal`
//! via the `From` impl already defined on `ApiError`.

use sabnode_common::ApiError;

/// Local alias matching `sabnode_common::Result<T>`.
pub type Result<T> = std::result::Result<T, ApiError>;
