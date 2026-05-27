//! # sabwriter-versions
//!
//! Append-only history of SabWriter document content snapshots. A new
//! row is inserted each time `saveSabwriterVersion` is called.
//!
//! Collection: `sabwriter_document_versions`. Restore is performed at
//! the TS layer: read a version, then `update_document` with the
//! restored `contentJson`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
