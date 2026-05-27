//! # sabwriter-presence
//!
//! Ephemeral collab presence — short-TTL rows that record where each
//! online collaborator's cursor / selection lives in the document. The
//! TS layer polls this endpoint (or, eventually, an OT/CRDT transport)
//! to render remote cursors and avatar dots.
//!
//! Collection: `sabwriter_presence`. The collection is expected to carry
//! a TTL index on `lastSeenAt` (60-second expiry) — owned by ops.
//!
//! This crate is intentionally a "thin in/out" surface — no audit, no
//! versioning. Presence is best-effort and disposable.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
