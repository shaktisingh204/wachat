//! # sabassist-devices
//!
//! HTTP surface for SabAssist registered unattended devices. Mount under
//! `/v1/sabassist/devices`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
