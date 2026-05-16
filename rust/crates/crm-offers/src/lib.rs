//! # crm-offers
//!
//! HTTP surface for HR Offer entity. Candidate offer letters with
//! salary breakdown, joining date, expiry, and full lifecycle status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
