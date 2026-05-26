//! # sabbugs-versions
//!
//! HTTP surface for `BugVersion` — release/version label used to mark
//! "affected" and "fixed-in" versions on bugs. Scoped per `userId` and
//! optionally linked to a `projectId`.
//!
//! Mongo collection: `sabbugs_versions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
