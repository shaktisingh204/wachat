//! # crm-shifts
//!
//! HTTP surface for HR Shift definitions. Name + code + start/end time +
//! break/grace minutes + working days + department scoping + default flag.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
