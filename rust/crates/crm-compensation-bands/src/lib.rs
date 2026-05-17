//! # crm-compensation-bands
//!
//! HTTP surface for the Compensation Band entity. A salary band
//! attached to a role/level/department with min/mid/max ranges,
//! currency, and a list of perks. Reads/writes
//! `crm_compensation_bands`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
