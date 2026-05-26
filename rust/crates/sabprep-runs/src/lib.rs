//! # sabprep-runs
//!
//! Read-only HTTP surface for SabPrep execution logs. Rows are written
//! into `sabprep_runs` by `sabprep-recipes::handlers::run_recipe`.
//!
//! Routes (mount at `/v1/sabprep/runs`):
//! ```text
//! GET /                   — list_runs (filter by recipeId)
//! GET /{runId}            — get_run
//! ```

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
