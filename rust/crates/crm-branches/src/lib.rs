//! # crm-branches
//!
//! HTTP surface for the Branch foundational lookup entity. Tenant-owned
//! physical/logical locations referenced by items, accounts, vendors,
//! and employees.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
