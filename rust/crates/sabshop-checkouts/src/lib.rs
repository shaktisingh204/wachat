//! # sabshop-checkouts
//!
//! HTTP surface for in-progress checkout sessions. Reads/writes
//! `sabshop_checkouts` Mongo collection. A checkout wraps a cart and
//! tracks step progression: address -> shipping -> payment -> review.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
