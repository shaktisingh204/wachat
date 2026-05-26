//! # sabbi-datasets
//!
//! HTTP surface for the SabBI dataset entity. A dataset is a named pointer
//! at a tabular data source: a SabFiles-hosted CSV, a system-tagged Mongo
//! collection, or a saved REST endpoint. The Rust query exec layer
//! materialises rows from the source at runtime.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
