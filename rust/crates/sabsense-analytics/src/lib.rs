//! # sabsense-analytics
//!
//! SabSense - Analytics Events CRUD.
//! Mountable router. Mount under `/v1/sabsense/analytics`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
