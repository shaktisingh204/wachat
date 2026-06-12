//! # crm-shift-rotations
//!
//! HTTP surface for employee shift rotation assignments. A rotation defines
//! a recurring `pattern` of shifts over a `cycleDays`-long cycle, optionally
//! scoped to an employee, department, or team.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
