//! # sabbugs-comments
//!
//! Append-only comment thread on a `Bug`. The thread is filtered by
//! `bugId` and sorted ascending by `createdAt`. Edits update only
//! `body` + `updatedAt`; deletes are soft (status = "deleted") to keep
//! audit history.
//!
//! Mongo collection: `sabbugs_comments`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
