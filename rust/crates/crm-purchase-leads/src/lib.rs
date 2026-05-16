//! # crm-purchase-leads
//!
//! HTTP surface for Purchase Lead / Hire Request entity. Title + category
//! + vendor candidate + qty + required-by + stage + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
