//! # sabpractice-deadlines
//!
//! HTTP surface for SabPractice compliance deadlines — tax filings,
//! payroll runs, GST returns, audit checkpoints. Status flips
//! `upcoming → in_progress → filed` (or `overdue` if past dueDate). The
//! `filed` endpoint stamps `completedAt`.
//!
//! Mount under `/v1/sabpractice/deadlines`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
