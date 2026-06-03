//! # sabsense-brand-safety
//!
//! SabSense - Brand Safety Reports CRUD.
//! Mountable router. Mount under `/v1/sabsense/brand-safety`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
