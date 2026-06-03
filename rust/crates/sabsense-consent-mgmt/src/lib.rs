//! # sabsense-consent-mgmt
//!
//! SabSense - Consent Management Records CRUD.
//! Mountable router. Mount under `/v1/sabsense/consent-mgmt`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
