//! # sabrewards-programs
//!
//! HTTP surface for the unified SabRewards Program entity. Reads/writes
//! `sabrewards_programs`. References an optional `tierEngineRef`
//! (`crm_loyalty_programs._id`) so the existing loyalty tier engine is
//! reused — not duplicated.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
