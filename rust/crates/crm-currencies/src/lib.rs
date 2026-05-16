//! # crm-currencies
//!
//! HTTP surface for the Currency master entity. ISO 4217 code + name +
//! symbol + exchange rate (vs the tenant's base currency) + display
//! formatting (prefix/suffix, decimal places, separators) + a single
//! per-tenant `isBase` flag.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
