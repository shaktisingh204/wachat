//! # crm-coupons
//!
//! HTTP surface for the Coupon promotional entity. Tracks discount codes,
//! usage limits, validity windows, and applicable products. Reads/writes
//! the `crm_coupons` Mongo collection.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
