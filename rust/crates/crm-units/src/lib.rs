//! # crm-units
//!
//! HTTP surface for the Unit of Measure master entity. Tracks short
//! symbols (`kg`, `pcs`, `box`), optional unit type classification, and
//! optional conversion factors against a base unit.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
