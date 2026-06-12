//! # crm-production-orders
//!
//! HTTP surface for Production Order entity. Links to a BOM and tracks
//! plannedQty, actualYield, scrap, machine, status (planned/in-progress/
//! complete/archived).

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
