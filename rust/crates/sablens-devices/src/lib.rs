//! # sablens-devices
//!
//! Registered customer devices for repeat unattended remote support. A
//! technician can re-connect to a previously-paired device without a
//! fresh join-token roundtrip.
//!
//! Mongo collection: `sablens_devices`. Mount under `/v1/sablens/devices`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
