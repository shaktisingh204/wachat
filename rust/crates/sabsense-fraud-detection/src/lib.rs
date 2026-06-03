//! # sabsense-fraud-detection
//!
//! SabSense - Fraud Detection Reports CRUD.
//! Mountable router. Mount under `/v1/sabsense/fraud-detection`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
