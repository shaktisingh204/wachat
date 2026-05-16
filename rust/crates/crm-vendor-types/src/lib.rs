//! # crm-vendor-types
//!
//! HTTP surface for the Vendor Type master entity. A small classification
//! lookup (`Goods Supplier`, `Service Provider`, `Contractor`, ...) that
//! lives alongside CRM Vendors. One row per (`userId`, `name`).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
