//! # sabbi-workbooks
//!
//! Workbook entity — a named collection of datasets + chart configs. A
//! workbook is the unit of saving / sharing in the SabBI workspace.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
