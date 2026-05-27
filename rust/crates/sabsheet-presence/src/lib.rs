//! # sabsheet-presence
//!
//! Ephemeral collab presence. Short-TTL upserts of `(sheetId, userId)` ->
//! selection coordinates so the grid can render other users' cursors.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
