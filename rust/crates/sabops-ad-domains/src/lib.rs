//! # sabops-ad-domains
//!
//! Active Directory domain connection registry. One row per AD domain
//! controller the tenant has paired (read-only or two-way sync).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
