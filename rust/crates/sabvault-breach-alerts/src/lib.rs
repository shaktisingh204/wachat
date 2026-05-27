//! # sabvault-breach-alerts
//!
//! Per-secret breach-status cache. Provider lookup happens CLIENT-SIDE
//! (HIBP k-anonymity); this crate only stores results. Mount under
//! `/v1/sabvault/breach-alerts`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
