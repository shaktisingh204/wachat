//! # sabtables-comments
//!
//! Threaded per-record comments. Each document references a record id;
//! a non-null `parentCommentId` makes the row a reply. The crate ships
//! a flat list endpoint — threading is reconstructed client-side.
//!
//! Mongo collection: `sabtables_comments`. Mount under
//! `/v1/sabtables/comments`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
