//! # agile-velocity
//!
//! Historical velocity snapshots — one row per completed sprint with planned
//! vs completed points. Used to render velocity bar charts and forecast
//! capacity for upcoming sprints.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
