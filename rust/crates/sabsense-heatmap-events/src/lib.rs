//! # pagesense-heatmap-events
//!
//! Raw point events captured by the client snippet — `click`, `move`,
//! `scroll`. **High-volume time-series**; design priorities:
//!   1. Append-only — no mutating handlers.
//!   2. Bulk inserts via `insert_many` from a batched ingest call.
//!   3. Indexes (declared by the host `api` crate at boot):
//!        - `{ siteId: 1, url: 1, ts: -1 }` — heatmap aggregation pages
//!        - `{ siteId: 1, sessionId: 1, ts: 1 }` — recording lookup
//!        - TTL on `ts` (e.g. 90d) — raw retention; aggregates live longer
//!
//! Mongo collection: `pagesense_heatmap_events`.
//! TODO: once write volume justifies it, swap the Mongo backend for a
//! columnar store (ClickHouse / Tinybird) — the aggregator queries are
//! the only consumers and live in the `pagesense-heatmaps` crate.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
