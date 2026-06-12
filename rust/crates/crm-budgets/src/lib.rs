//! # crm-budgets
//!
//! HTTP surface for Budget entity. Plan-vs-actual spend tracking,
//! approval workflow (draft → approved → locked), per-period rollups.

pub mod dto;
pub mod handlers;
pub mod router;
pub mod types;

pub use router::{project_router, router};
