//! # sabvault-audit
//!
//! Append-only audit log for SabVault. Mount under `/v1/sabvault/audit`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
