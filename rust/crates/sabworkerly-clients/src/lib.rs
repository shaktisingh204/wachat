//! # sabworkerly-clients
//!
//! HTTP surface for the SabWorkerly Client entity — a staffing-agency
//! client business that books temp workers. Mounts at
//! `/v1/sabworkerly/clients`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
