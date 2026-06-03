//! # sabsense-viewability
//!
//! SabSense - Viewability Records CRUD.
//! Mountable router. Mount under `/v1/sabsense/viewability`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
