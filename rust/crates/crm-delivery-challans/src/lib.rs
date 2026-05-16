//! # crm-delivery-challans
//!
//! HTTP surface for Delivery Challan entity. Goods-out doc with line
//! items + transport details (vehicle/driver/mode) + status.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
