//! # crm-company-profile
//!
//! HTTP surface for the Company Profile entity (W11). Tenant company
//! information master: legal name, branding, addresses, tax IDs, banking,
//! social links, locale defaults, and brand color. One profile may be the
//! tenant's default.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
