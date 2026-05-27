//! # sabvault-shares
//!
//! HTTP surface for SabVault share-grant records. Only the secret's owner
//! may grant/revoke. Mount under `/v1/sabvault/shares`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
