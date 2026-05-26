//! # sabshop-shipping-zones
//!
//! HTTP surface for storefront shipping zones. Each zone is a list of
//! regions plus a rate card. Reads/writes `sabshop_shipping_zones`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
