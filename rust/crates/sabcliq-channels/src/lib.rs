//! # sabcliq-channels
//!
//! HTTP surface for SabCliq Channels — public, private, and direct
//! conversations inside a workspace. Each channel carries an explicit
//! `memberUserIds` array; sibling crates use `is_channel_member` to
//! gate reads/writes on `messages`, `threads`, etc.
//!
//! Mounted under `/v1/sabcliq/channels`.

pub mod dto;
// `handlers` + `router` modules were drafted by an agent that died
// mid-build; the source files were never written. Keeping the crate as a
// DTO-only stub until the HTTP surface is rebuilt. The membership
// helpers remain usable by sibling sabcliq-* crates.
pub mod membership;
pub mod types;

pub use membership::{is_channel_member, load_channel};
