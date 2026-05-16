//! # crm-product-categories
//!
//! HTTP surface for the Product Category foundational lookup entity.
//! Referenced by items/products. Reads/writes the `crm_product_categories`
//! Mongo collection. Supports nested categories via `parentId`.
//!
//! ## Soft delete
//! `DELETE /v1/crm/product-categories/:id` sets `status: "archived"` rather
//! than removing the row so referenced documents stay valid.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
