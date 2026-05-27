//! # sabsheet-cells
//!
//! Cell entity for SabSheet plus an embedded formula evaluator
//! (`formula.rs`). Cells are sparse — only cells with a non-empty
//! value/formula/format are stored.

pub mod dto;
pub mod formula;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
