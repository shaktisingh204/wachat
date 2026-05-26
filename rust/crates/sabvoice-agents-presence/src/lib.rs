//! # sabvoice-agents-presence
//!
//! HTTP surface for the live agent-presence entity. One row per agent
//! userId; updates are upserts keyed on (userId, agentUserId).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
