//! # crm-auto-leads
//!
//! HTTP surface for the Auto Lead Rule entity. Rules drive automatic
//! routing/assignment of inbound leads based on a flexible set of
//! conditions (source, keyword, channel, etc.) to a user or team.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
