//! # sabops-ad-users
//!
//! Mirrored AD users. Documents are upserted by the AD sync worker keyed
//! on `(domainId, samAccountName)`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
