//! # sabbugs-history
//!
//! Append-only change log for `Bug` documents. Records every field
//! mutation as `{ bugId, ts, actorId, field, oldValue, newValue }`.
//! Read-mostly: clients GET a paginated list filtered by `bugId`;
//! writes come from `sabbugs-bugs` (server-to-server) OR from the
//! Next.js server action layer.
//!
//! Mongo collection: `sabbugs_history`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
