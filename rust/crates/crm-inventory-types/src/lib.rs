//! # crm-inventory-types
//!
//! DTOs for CRM Inventory (`crm_function_plan.md` §3): items, warehouses,
//! stock adjustments, and report request envelopes. Every entity flattens
//! `crm-core` cross-cutting fragments.

pub mod item;
pub mod reports;
pub mod stock_adjustment;
pub mod warehouse;

pub use item::*;
pub use reports::*;
pub use stock_adjustment::*;
pub use warehouse::*;
