//! # crm-gift-cards
//!
//! HTTP surface for the Gift Card entity. Tracks code, value, balance,
//! recipient, expiry, transferability. Reads/writes `crm_gift_cards`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
