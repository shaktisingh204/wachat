//! # sabconnect-comments
//!
//! Threaded comments on SabConnect feed items. Replies link to a parent
//! comment via `parentCommentId`. Attachments are SabFiles file ids.
//!
//! Mount under `/v1/sabconnect/comments`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
