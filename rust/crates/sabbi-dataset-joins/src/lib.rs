//! # sabbi-dataset-joins
//!
//! Saved join definitions between SabBI datasets: left + right dataset ids,
//! join type, and column mapping. The Rust query exec module evaluates
//! the join at chart-render time.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
