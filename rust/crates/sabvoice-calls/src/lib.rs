//! # sabvoice-calls
//!
//! HTTP surface for the Voice Call (CDR) entity.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
