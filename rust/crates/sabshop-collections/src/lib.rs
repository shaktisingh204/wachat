//! # sabshop-collections
//!
//! HTTP surface for SabShop product collections. Reads/writes the
//! `sabshop_collections` Mongo collection.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
