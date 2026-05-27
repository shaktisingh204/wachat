//! # sabwriter-comments
//!
//! Inline comments anchored to a TipTap/ProseMirror text range
//! (`{from, to}` document offsets). Comments thread via
//! `parentCommentId`, and any comment can be `resolved`.
//!
//! Collection: `sabwriter_comments`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
