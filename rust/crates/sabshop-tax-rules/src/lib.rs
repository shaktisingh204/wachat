//! # sabshop-tax-rules
//!
//! HTTP surface for SabShop tax rules. Reads/writes
//! `sabshop_tax_rules` Mongo collection.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
