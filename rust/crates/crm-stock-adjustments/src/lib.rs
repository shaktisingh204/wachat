//! # crm-stock-adjustments
//!
//! HTTP surface for the Stock Adjustment inventory-tier entity. Mirrors
//! the legacy TS `CrmStockAdjustment` shape against the
//! `crm_stock_adjustments` Mongo collection. Includes multi-line edits
//! and an approval workflow (pending → approved | rejected).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
