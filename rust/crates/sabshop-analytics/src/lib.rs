//! # sabshop-analytics
//!
//! HTTP surface for SabShop analytics and reporting (dummy data/aggregations).

pub mod dto;
pub mod handlers;
pub mod router;

pub use router::router;
