//! # sabassist-actions-log
//!
//! Append-only audit log for SabAssist session actions. There is no
//! update or delete route by design — history is immutable.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
