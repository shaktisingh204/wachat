//! # sabpractice-firms
//!
//! HTTP surface for the SabPractice Firm entity — the accounting firm
//! itself (registration, services offered, status). Usually one per
//! tenant, but the schema permits multiple (e.g. branch offices).
//!
//! Mount under `/v1/sabpractice/firms` from the host `api` crate.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
