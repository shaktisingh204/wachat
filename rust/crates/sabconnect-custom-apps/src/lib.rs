//! # sabconnect-custom-apps
//!
//! Minimal custom-app stub so users can pin tools (Looker links,
//! internal dashboards, etc.) into the SabConnect surface.
//!
//! Mount under `/v1/sabconnect/custom-apps`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
