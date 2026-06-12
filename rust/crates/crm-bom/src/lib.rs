//! # crm-bom
//!
//! HTTP surface for Bill of Materials. Each BOM is a recipe linking a
//! finished good to one or more component items with qty + scrap %.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
