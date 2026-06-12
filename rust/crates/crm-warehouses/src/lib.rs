//! # crm-warehouses
//!
//! HTTP surface for the Warehouse inventory-tier entity. Mirrors the
//! legacy TS `CrmWarehouse` shape against the `crm_warehouses` Mongo
//! collection.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
