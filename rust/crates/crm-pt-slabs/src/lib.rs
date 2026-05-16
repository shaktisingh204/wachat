//! # crm-pt-slabs
//!
//! HTTP surface for the Professional Tax Slab entity. State + gender +
//! income range (min/max) + tax amount + effective date + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
