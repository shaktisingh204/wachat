//! # sabshop-orders
//!
//! HTTP surface for placed SabShop orders. Reads/writes the
//! `sabshop_orders` Mongo collection.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
