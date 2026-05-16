//! # crm-contracts
//!
//! HTTP surface for Contract entity. Party + scope + deliverables +
//! effective/expiry dates + autoRenew + value + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
