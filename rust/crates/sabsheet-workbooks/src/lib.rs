//! # sabsheet-workbooks
//!
//! Workbook entity for SabSheet — the Zoho Sheet equivalent. A workbook is
//! the root sharable document; sheets, cells, named ranges, pivots,
//! comments, versions, and presence all live under it.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
