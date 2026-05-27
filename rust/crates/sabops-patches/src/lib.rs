//! # sabops-patches
//!
//! Available patches per endpoint. Inventory rows describing OS / app
//! updates pending or applied (severity, kb id, lifecycle status).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
