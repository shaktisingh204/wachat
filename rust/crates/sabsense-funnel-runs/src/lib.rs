//! # pagesense-funnel-runs
//!
//! Funnel computation snapshots — the materialized result of running a
//! funnel definition against `pagesense_heatmap_events` for a window.
//! Mongo collection: `pagesense_funnel_runs`.
//!
//! TODO: the real run computation is stubbed; the `run` handler
//! currently writes a zeroed result so the UI has something to render.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
