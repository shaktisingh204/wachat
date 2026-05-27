//! # sabworkerly-workers
//!
//! HTTP surface for the SabWorkerly Worker entity — a temp/agency staffing
//! worker. Mounts at `/v1/sabworkerly/workers` from the host `api` crate.
//!
//! ## Schema highlights
//! - Skills, availability (free-form JSON), hourly pay rate (minor units).
//! - Documents reference SabFiles via `documentIds[]` (ID, visa, certs).
//! - Status: `active | inactive | on_assignment`.
//!
//! ## Soft delete
//! `DELETE /v1/sabworkerly/workers/:id` sets `status: "inactive"` rather
//! than removing the row.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
