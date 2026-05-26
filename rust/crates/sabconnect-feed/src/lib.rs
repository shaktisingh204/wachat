//! # sabconnect-feed
//!
//! Unified activity feed for SabConnect. Stores the canonical "post"
//! object that the SabConnect feed renders, plus references to the feed
//! entries spawned by other workspace modules (announcements,
//! recognitions, events). Documents are scoped by `userId` (tenant key).
//!
//! The HTTP surface lives under `/v1/sabconnect/feed`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
