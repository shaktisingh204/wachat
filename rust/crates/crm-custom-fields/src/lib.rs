//! # crm-custom-fields
//!
//! HTTP surface for per-entity Custom Field definitions. EntityKind +
//! internal name + display label + field type (+ options, validation,
//! placement & visibility flags).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
