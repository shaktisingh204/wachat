//! # crm-one-on-ones
//!
//! HTTP surface for the OneOnOne entity. 1:1 meetings between manager
//! and report — agenda, discussion notes, action items, mood, engagement.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
