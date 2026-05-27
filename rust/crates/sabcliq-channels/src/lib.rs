//! # sabcliq-channels
//!
//! HTTP surface for SabCliq Channels — public, private, and direct
//! conversations inside a workspace. Each channel carries an explicit
//! `memberUserIds` array; sibling crates use `is_channel_member` to
//! gate reads/writes on `messages`, `threads`, etc.
//!
//! Mounted under `/v1/sabcliq/channels`.

pub mod dto;
pub mod handlers;
pub mod membership;
pub mod router;
pub mod types;

pub use membership::{is_channel_member, load_channel};
pub use router::router;
