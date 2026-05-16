//! # crm-products
//!
//! HTTP surface for the inventory **Product** entity. Distinct from the
//! richer `crm-items` crate (which serves `/v1/crm/items` over the same
//! legacy `crm_products` collection): this crate models a **fresh,
//! simplified product type** with flat pricing (`buyPrice`/`sellPrice`),
//! flat `stock`/`reorderLevel`, and string `category`/`brand`/`unit`.
//!
//! Mounted at `/v1/crm/products`.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::router;
