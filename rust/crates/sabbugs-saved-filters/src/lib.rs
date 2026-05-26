//! # sabbugs-saved-filters
//!
//! Per-user saved filter queries for the SabBugs list view. A filter
//! stores an opaque JSON object the UI can re-apply (status, severity,
//! assignee, etc.). When `isShared = true`, the filter is visible to any
//! user under the same `userId` tenant scope.
//!
//! Mongo collection: `sabbugs_saved_filters`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
