//! # sabsheet-named-ranges
//!
//! Per-workbook named cell ranges, e.g. `SALES_2024 = Sheet1!A1:D100`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
