//! # crm-recognitions
//!
//! HTTP surface for the Recognition entity. Tracks peer-to-peer
//! recognition entries with category, message, optional points/badge,
//! and visibility flag. Reads/writes `crm_recognitions`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
