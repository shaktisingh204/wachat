//! # crm-brands
//!
//! HTTP surface for the Brand foundational lookup entity. Referenced by
//! items/products. Reads/writes the `crm_brands` Mongo collection.
//!
//! ## Soft delete
//! `DELETE /v1/crm/brands/:id` sets `status: "archived"` rather than removing
//! the row so referenced documents stay valid.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
