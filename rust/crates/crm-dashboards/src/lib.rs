//! # crm-dashboards
//!
//! HTTP surface for the per-user customizable Dashboard entity:
//! name + description + layout + widgets + isDefault + scope.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
