//! # crm-loyalty-programs
//!
//! HTTP surface for the Loyalty Program entity. Tracks point accrual
//! rules, redemption ratios, expiry, tiers, and bonuses. Reads/writes
//! `crm_loyalty_programs`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
