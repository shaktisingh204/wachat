//! # sabconnect-reactions
//!
//! Emoji reactions on SabConnect feed items. One reaction per
//! (itemId, userId, emoji) — re-posting the same reaction toggles it off.
//!
//! Mount under `/v1/sabconnect/reactions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
