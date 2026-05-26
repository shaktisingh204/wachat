//! # pagesense-heatmaps
//!
//! Aggregated heatmap snapshots — the "ready to render" rollup of
//! `pagesense_heatmap_events`. Each row holds:
//!   - a grid of click counts (bucketed at a fixed resolution)
//!   - scroll-depth distribution (decile buckets)
//!
//! Mongo collection: `pagesense_heatmaps`.
//!
//! TODO: the aggregator job that builds these is not in this crate —
//! design choice is to either (a) periodic cron on the Next.js side
//! using Vercel Cron, or (b) a dedicated Rust worker. For now this
//! crate just exposes CRUD + a `regenerate` endpoint that scans
//! events on demand.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
