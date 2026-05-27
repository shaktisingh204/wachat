//! # sabpractice-engagements
//!
//! HTTP surface for SabPractice Engagement entities — a scoped piece of
//! work for a client (e.g. "FY26 audit", "Monthly bookkeeping"). Carries
//! billing cadence + hourly rate so time-logs can roll up to invoices.
//!
//! Mount under `/v1/sabpractice/engagements`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
