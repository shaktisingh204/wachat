//! # crm-learning-paths
//!
//! HTTP surface for the Learning Path entity — a curated bundle of
//! training references for an audience (`all`, `department`, or `role`).
//! Reads/writes `crm_learning_paths`.
//!
//! Note: the TS server actions persist `target_audience`, `duration_weeks`
//! and `is_mandatory` in `snake_case`. The Rust type mirrors that exactly
//! via `serde(rename)` so the two paths stay byte-compatible.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
